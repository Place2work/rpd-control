"use server";

import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { obtenerSesion } from "@/lib/auth/sesion";
import { cifrar, hashIdentificador } from "@/lib/cripto";
import { conUsuario } from "@/lib/db/prisma";
import { parametrosVigentes } from "@/lib/parametros";
import { esquemaAlta } from "@/lib/prospectos/validacion";
import { curpParcial, datosDeCurp } from "@/lib/reglas/identificadores";
import { hoyCDMX } from "@/lib/tiempo";

export type Duplicado = { campo: "telefono" | "curp" | "nss"; persona_id: string | null; visible: boolean };

export type EstadoAlta = {
  errores?: Record<string, string>;
  duplicados?: Duplicado[];
  mensaje?: string;
  valores?: Record<string, string>;
};

const fecha = (iso: string) => new Date(`${iso}T00:00:00Z`);

// Alta rápida (10.2): persona + caso con folio + fecha de baja + primer evento, en una
// sola transacción con RLS. CURP y NSS se guardan cifrados con su índice ciego.
export async function crearProspecto(_previo: EstadoAlta, form: FormData): Promise<EstadoAlta> {
  const { claims, ip, usuario } = await obtenerSesion();
  const valores = Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;

  const r = esquemaAlta.safeParse(valores);
  if (!r.success) {
    const errores: Record<string, string> = {};
    for (const i of r.error.issues) errores[String(i.path[0])] ??= i.message;
    return { errores, valores };
  }
  const d = r.data;
  const curpHash = d.curp ? hashIdentificador("curp", d.curp) : null;
  const nssHash = d.nss ? hashIdentificador("nss", d.nss) : null;

  // Duplicados (10.2): CURP o NSS repetidos bloquean; el mismo teléfono solo avisa.
  const duplicados = await conUsuario(
    claims,
    (tx) => tx.$queryRaw<Duplicado[]>`SELECT * FROM app.buscar_duplicados(${d.whatsapp}, ${curpHash}, ${nssHash})`,
    ip,
  );
  if (duplicados.some((x) => x.campo !== "telefono")) {
    return { duplicados, valores, mensaje: "Ya hay una persona registrada con esa CURP o ese NSS." };
  }
  if (duplicados.length > 0 && !d.confirmar_duplicado) {
    return { duplicados, valores, mensaje: "Ya hay una persona con ese WhatsApp." };
  }

  const { PRIVACIDAD_VERSION } = await parametrosVigentes(["PRIVACIDAD_VERSION"]);
  const deCurp = d.curp ? datosDeCurp(d.curp) : null;

  let casoId: string;
  try {
    casoId = await conUsuario(
      claims,
      async (tx) => {
        const persona = await tx.persona.create({
          select: { id: true },
          data: {
            nombre: d.nombre,
            apellido_paterno: d.apellido_paterno,
            apellido_materno: d.apellido_materno,
            telefono: d.whatsapp,
            whatsapp: d.whatsapp,
            origen: d.origen as Prisma.PersonaCreateInput["origen"],
            referidor_id: d.referidor_id,
            owner_id: usuario.id,
            curp_cifrada: d.curp ? cifrar(d.curp) : undefined,
            curp_hash: curpHash,
            curp_parcial: d.curp ? curpParcial(d.curp) : undefined,
            fecha_nacimiento: deCurp ? fecha(deCurp.fechaNacimiento) : undefined,
            sexo: deCurp?.sexo,
            nss_cifrado: d.nss ? cifrar(d.nss) : undefined,
            nss_hash: nssHash,
            nss_ultimos4: d.nss?.slice(-4),
            privacidad_aceptada_at: d.privacidad ? new Date() : undefined,
            privacidad_version: d.privacidad ? PRIVACIDAD_VERSION : undefined,
            privacidad_ip: d.privacidad ? ip : undefined,
          },
        });
        const caso = await tx.caso.create({
          select: { id: true },
          data: {
            persona_id: persona.id,
            tipo_servicio: d.tipo_servicio,
            owner_id: usuario.id,
            vendedor_id: usuario.rol === "vendedor" ? usuario.id : undefined,
            socio_id: usuario.rol === "socio" ? usuario.socio_id : undefined,
            asignado_a: usuario.rol === "asesor" ? usuario.id : undefined,
            referidor_id: d.referidor_id,
            fecha_primer_contacto: fecha(hoyCDMX()),
          },
        });
        if (d.fecha_baja) {
          await tx.datosImss.create({ data: { caso_id: caso.id, fecha_baja: fecha(d.fecha_baja) } });
        }
        await tx.historialEtapa.create({ data: { caso_id: caso.id, etapa_nueva: "PROSPECTO", usuario_id: usuario.id } });
        await tx.evento.create({
          data: { caso_id: caso.id, tipo: "sistema", texto: "Alta de prospecto", usuario_id: usuario.id, datos: { origen: d.origen } },
        });
        return caso.id;
      },
      ip,
    );
  } catch (e) {
    // Dos altas simultáneas con la misma CURP/NSS: gana la primera.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { valores, mensaje: "Ya hay una persona registrada con esa CURP o ese NSS." };
    }
    throw e;
  }

  redirect(`/casos/${casoId}?nuevo=1`);
}
