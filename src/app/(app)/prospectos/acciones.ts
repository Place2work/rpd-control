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
import { limpiarNombre } from "@/lib/reglas/nombres";
import { leerCostoAlta } from "@/lib/reglas/costo-alta";
import { mxn } from "@/lib/formato";

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
  // Un cliente puede pedir varios servicios: se abre un caso por cada uno (cada uno con su embudo, contrato y cobro).
  const servicios = [...new Set(form.getAll("tipo_servicio").filter((v): v is string => typeof v === "string" && /^[A-Z0-9_]{2,40}$/.test(v)))];
  valores.tipo_servicio = servicios[0] ?? "";
  valores.servicios = servicios.join(",");

  const r = esquemaAlta.safeParse(valores);
  if (!r.success) {
    const errores: Record<string, string> = {};
    for (const i of r.error.issues) errores[String(i.path[0])] ??= i.message;
    return { errores, valores };
  }
  // Costo administrativo propio de esta alta (solo el Director; vacío = el general).
  let costoAlta: number | null = null;
  if (usuario.rol === "director") {
    const leido = leerCostoAlta(String(form.get("costo_admin_alta") ?? ""));
    if ("error" in leido) return { errores: { costo_admin_alta: leido.error }, valores };
    costoAlta = leido.costo;
  }
  const d = { ...r.data, ...limpiarNombre({ nombre: r.data.nombre, apellido_paterno: r.data.apellido_paterno ?? null, apellido_materno: r.data.apellido_materno ?? null }) };
  const curpHash = d.curp ? hashIdentificador("curp", d.curp) : null;
  const nssHash = d.nss ? hashIdentificador("nss", d.nss) : null;

  // Duplicados (10.2): CURP o NSS repetidos bloquean; el mismo teléfono solo avisa.
  const duplicados = await conUsuario(
    claims,
    (tx) => tx.$queryRaw<Duplicado[]>`SELECT * FROM app.buscar_duplicados(${d.whatsapp ?? null}, ${curpHash}, ${nssHash})`,
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
        const validos = await tx.tipoServicio.findMany({ where: { clave: { in: servicios }, activo: true }, select: { clave: true, nombre: true } });
        const orden = servicios.filter((s) => validos.some((v) => v.clave === s));
        if (!orden.length) throw new Error("SERVICIO_INVALIDO");
        let primero: string | null = null;
        for (const servicio of orden) {
          const caso = await tx.caso.create({
            select: { id: true },
            data: {
              persona_id: persona.id,
              tipo_servicio: servicio,
              owner_id: usuario.id,
              vendedor_id: usuario.rol === "vendedor" ? usuario.id : undefined,
              socio_id: usuario.rol === "socio" ? usuario.socio_id : undefined,
              asignado_a: usuario.rol === "asesor" ? usuario.id : undefined,
              referidor_id: d.referidor_id,
              fecha_primer_contacto: fecha(hoyCDMX()),
              costo_admin_alta: costoAlta ?? undefined,
            },
          });
          if (d.fecha_baja) {
            await tx.datosImss.create({ data: { caso_id: caso.id, fecha_baja: fecha(d.fecha_baja) } });
          }
          await tx.historialEtapa.create({ data: { caso_id: caso.id, etapa_nueva: "PROSPECTO", usuario_id: usuario.id } });
          const otros = validos.filter((v) => v.clave !== servicio).map((v) => v.nombre.split(" (")[0]);
          await tx.evento.create({
            data: { caso_id: caso.id, tipo: "sistema", usuario_id: usuario.id, datos: { origen: d.origen },
              texto: [otros.length ? `Alta de prospecto · también pidió: ${otros.join(", ")}` : "Alta de prospecto",
                costoAlta !== null ? `costo administrativo ${mxn(costoAlta)}` : null].filter(Boolean).join(" · ") },
          });
          primero ??= caso.id;
        }
        return primero!;
      },
      ip,
    );
  } catch (e) {
    // Dos altas simultáneas con la misma CURP/NSS: gana la primera.
    if (e instanceof Error && e.message === "SERVICIO_INVALIDO") return { valores, errores: { tipo_servicio: "Elige al menos un servicio" } };
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { valores, mensaje: "Ya hay una persona registrada con esa CURP o ese NSS." };
    }
    throw e;
  }

  redirect(`/casos/${casoId}?nuevo=1`);
}
