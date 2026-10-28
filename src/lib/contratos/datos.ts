// Datos con que se llena un contrato o aviso de privacidad. Con `completo`, CURP y NSS se
// descifran con verDatoSensible() (queda renglón en la bitácora por cada dato); sin él, solo se
// indica si están capturados, para mostrar qué falta sin abrir datos sensibles.
import "server-only";
import type { Sesion } from "@/lib/auth/sesion";
import { conUsuario, prismaSistema } from "@/lib/db/prisma";
import { verDatoSensible } from "@/lib/db/sensibles";
import { formatoFechaLarga } from "@/lib/formato";
import { parametrosVigentes } from "@/lib/parametros";
import { hoyCDMX } from "@/lib/tiempo";
import { pesosEnLetra, porcentajeEnLetra } from "./letras";
import type { Datos } from "./plantilla";
import { PLANTILLAS_INICIALES } from "./plantillas-iniciales";

export type Clase = "contrato" | "aviso_privacidad";
export type Firma = { titulo: string; nombre: string | null; detalle?: string | null };

const CAPTURADO = "(capturado)";
const nombreDe = (p: { nombre: string; apellido_paterno: string | null; apellido_materno: string | null }) =>
  [p.nombre, p.apellido_paterno, p.apellido_materno].filter(Boolean).join(" ");
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Datos sensibles que imprime una plantilla: los que aparecen como variable, más la CURP del cliente en las firmas del contrato. */
export function sensiblesDe(cuerpo: string, clase: Clase): Set<string> {
  const rutas = ["cliente.curp", "cliente.nss", "beneficiaria.curp", "finado.curp", "finado.nss"].filter((r) => cuerpo.includes(`{{${r}}}`));
  if (clase === "contrato") rutas.push("cliente.curp");
  return new Set(rutas);
}

export async function plantillaVigente(tipoServicio: string, clase: Clase, fecha: string) {
  const dia = new Date(`${fecha}T00:00:00Z`);
  const buscar = () => prismaSistema.plantillaContrato.findFirst({
    where: { clase, tipo_servicio: tipoServicio, vigente_desde: { lte: dia }, OR: [{ vigente_hasta: null }, { vigente_hasta: { gte: dia } }] },
    orderBy: { version: "desc" },
  });
  const hay = await buscar();
  if (hay) return hay;
  // Primera vez: se carga la versión 1 desde el código (es catálogo; lo escribe el sistema).
  const inicial = PLANTILLAS_INICIALES.find((x) => x.clase === clase && x.tipoServicio === tipoServicio);
  if (!inicial) return null;
  await prismaSistema.plantillaContrato.createMany({
    data: [{ clase, tipo_servicio: tipoServicio, version: 1, nombre: inicial.nombre, cuerpo: inicial.cuerpo, vigente_desde: new Date("2026-01-01T00:00:00Z") }],
    skipDuplicates: true,
  });
  return buscar();
}

/**
 * `abrir`: rutas de datos sensibles que el documento imprime completas (p. ej. "cliente.curp").
 * Solo esas se descifran; las demás solo indican si están capturadas.
 */
export async function datosContrato(s: Sesion, casoId: string, completo: boolean, abrir: ReadonlySet<string> = new Set()) {
  const caso = await conUsuario(s.claims, (tx) => tx.caso.findUnique({
    where: { id: casoId },
    include: {
      persona: true,
      partes: { where: { archivado_at: null } },
      datos_afore: { select: { afore: true } },
    },
  }), s.ip);
  if (!caso) return null;
  const fecha = caso.fecha_contrato ? iso(caso.fecha_contrato) : hoyCDMX();
  const p = await parametrosVigentes([
    "PRESTADOR_NOMBRE", "PRESTADOR_NOMBRE_COMERCIAL", "PRESTADOR_RFC", "PRESTADOR_REGIMEN", "PRESTADOR_DOMICILIO",
    "PRESTADOR_BANCO", "PRESTADOR_CUENTA", "PRESTADOR_CLABE", "CONTRATO_CIUDAD", "HONORARIO_RETIRO_PCT", "VIGENCIA_CONTRATO_DIAS",
    "FALLEC_HONORARIO_PCT_RECUPERADO", "FALLEC_REGIMEN_TEXTO",
  ], fecha);

  const sensible = async (ruta: string, tabla: "personas" | "partes_caso", id: string, campo: "curp" | "nss", hay: boolean) => {
    if (!hay) return null;
    return completo && abrir.has(ruta) ? verDatoSensible(s.claims, { tabla, campo }, id, s.ip) : CAPTURADO;
  };
  const per = caso.persona;
  const beneficiaria = caso.partes.find((x) => x.rol === "beneficiaria");
  const finado = caso.partes.find((x) => x.rol === "finado");
  const pct = caso.contrato_pct ? Number(caso.contrato_pct) : Number(p.FALLEC_HONORARIO_PCT_RECUPERADO);
  const advertencias = (caso.contrato_advertencias ?? "").split("\n").map((x) => x.trim()).filter(Boolean);

  const datos: Datos = {
    folio: caso.folio,
    ciudad: p.CONTRATO_CIUDAD,
    fecha_firma: formatoFechaLarga(fecha),
    vigencia_dias: p.VIGENCIA_CONTRATO_DIAS,
    prestador: {
      nombre: p.PRESTADOR_NOMBRE, nombre_comercial: p.PRESTADOR_NOMBRE_COMERCIAL, rfc: p.PRESTADOR_RFC, regimen: p.PRESTADOR_REGIMEN,
      domicilio: p.PRESTADOR_DOMICILIO, banco: p.PRESTADOR_BANCO, cuenta: p.PRESTADOR_CUENTA, clabe: p.PRESTADOR_CLABE,
    },
    cliente: {
      nombre: nombreDe(per),
      curp: await sensible("cliente.curp", "personas", per.id, "curp", Boolean(per.curp_parcial)),
      nss: await sensible("cliente.nss", "personas", per.id, "nss", Boolean(per.nss_ultimos4)),
      domicilio: per.domicilio, email: per.email, identificacion: per.identificacion, parentesco: finado?.parentesco_cliente,
    },
    honorario: { pct: p.HONORARIO_RETIRO_PCT ? porcentajeEnLetra(Number(p.HONORARIO_RETIRO_PCT)) : null },
    precio: {
      pago_unico: caso.honorario_fijo ? pesosEnLetra(Number(caso.honorario_fijo)) : null,
      pct_recuperado: Number.isFinite(pct) ? porcentajeEnLetra(pct) : null,
    },
    beneficiaria: beneficiaria ? {
      nombre: beneficiaria.nombre, relacion: beneficiaria.relacion, domicilio: beneficiaria.domicilio, identificacion: beneficiaria.identificacion,
      curp: await sensible("beneficiaria.curp", "partes_caso", beneficiaria.id, "curp", Boolean(beneficiaria.curp_parcial)),
    } : null,
    finado: finado ? {
      nombre: finado.nombre,
      curp: await sensible("finado.curp", "partes_caso", finado.id, "curp", Boolean(finado.curp_parcial)),
      nss: await sensible("finado.nss", "partes_caso", finado.id, "nss", Boolean(finado.nss_ultimos4)),
      fecha_defuncion: finado.fecha_defuncion ? formatoFechaLarga(iso(finado.fecha_defuncion)) : null,
      regimen: finado.regimen || p.FALLEC_REGIMEN_TEXTO,
      afore: finado.afore || caso.datos_afore?.afore || null,
    } : null,
    advertencias,
    regularizacion: caso.contrato_regularizacion,
  };

  const curpCliente = (datos.cliente as Datos).curp as string | null;
  const firmas: Record<Clase, Firma[]> = {
    contrato: [
      { titulo: "EL PRESTADOR", nombre: p.PRESTADOR_NOMBRE, detalle: caso.tipo_servicio === "FALLECIMIENTO" ? `Nombre comercial: ${p.PRESTADOR_NOMBRE_COMERCIAL}` : p.PRESTADOR_NOMBRE_COMERCIAL },
      { titulo: "EL CLIENTE", nombre: nombreDe(per), detalle: completo && abrir.has("cliente.curp") ? curpCliente : null },
      ...(caso.tipo_servicio === "FALLECIMIENTO"
        ? [{ titulo: "LA BENEFICIARIA", nombre: beneficiaria?.nombre ?? null, detalle: finado ? `Viuda de ${finado.nombre}` : null }, { titulo: "TESTIGO", nombre: null, detalle: "Nombre y firma" }]
        : []),
    ],
    aviso_privacidad: [
      { titulo: "cliente", nombre: nombreDe(per) },
      ...(beneficiaria ? [{ titulo: "beneficiaria", nombre: beneficiaria.nombre }] : []),
    ],
  };
  return { caso, fecha, datos, firmas };
}
