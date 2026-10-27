// Seed de la fase 0: parámetros (5.9), servicios (2.1), documentos (5.6), Afores,
// días inhábiles 2026-2027, esquemas de comisión (9.1) y plantillas de mensaje (8.3).
// Es idempotente: se puede correr varias veces sin duplicar.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "../src/generated/prisma/client";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL! }) });

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

// ───────────── Parámetros ─────────────
// Valores por defecto de las decisiones pendientes (14.3) incluidos; se cambian en Configuración.
const PARAMETROS: { clave: string; valor: string; tipo?: string; descripcion: string; desde?: string; hasta?: string }[] = [
  { clave: "UMA_DIARIA", valor: "117.31", descripcion: "UMA diaria", desde: "2026-02-01", hasta: "2027-01-31" },
  { clave: "UMA_MENSUAL", valor: "3566.22", descripcion: "UMA mensual", desde: "2026-02-01", hasta: "2027-01-31" },
  { clave: "HONORARIO_RETIRO_PCT", valor: "0.30", descripcion: "Honorario del retiro, IVA incluido" },
  { clave: "IVA", valor: "0.16", descripcion: "Tasa de IVA" },
  { clave: "DIAS_ESPERA_DESEMPLEO", valor: "46", tipo: "entero", descripcion: "Fecha elegible = baja + N días naturales (art. 191-II)" },
  { clave: "ANIOS_CANDADO_RETIRO", valor: "5", tipo: "entero", descripcion: "Años entre retiros por desempleo" },
  { clave: "SLA_DIAS_HABILES", valor: "15", tipo: "entero", descripcion: "Días hábiles para ingresar desde expediente completo" },
  { clave: "AFORE_DIAS_HABILES", valor: "5", tipo: "entero", descripcion: "Días hábiles de resolución de la Afore" },
  { clave: "VIGENCIA_CONTRATO_DIAS", valor: "90", tipo: "entero", descripcion: "Vigencia del contrato en días naturales" },
  { clave: "MODALIDAD_A_ANIOS", valor: "3", tipo: "entero", descripcion: "Antigüedad mínima de cuenta, modalidad A" },
  { clave: "MODALIDAD_A_BIMESTRES", valor: "12", tipo: "entero", descripcion: "Bimestres mínimos, modalidad A" },
  { clave: "MODALIDAD_A_DIAS_SBC", valor: "30", tipo: "entero", descripcion: "Días de SBC, modalidad A" },
  { clave: "MODALIDAD_A_TOPE_UMAS", valor: "10", tipo: "entero", descripcion: "Tope en UMAs mensuales, modalidad A" },
  { clave: "MODALIDAD_B_ANIOS", valor: "5", tipo: "entero", descripcion: "Antigüedad mínima de cuenta, modalidad B" },
  { clave: "MODALIDAD_B_DIAS_SBC", valor: "90", tipo: "entero", descripcion: "Días de SBC promedio 250 semanas, modalidad B" },
  { clave: "MODALIDAD_B_PCT_RCV", valor: "0.115", descripcion: "Porcentaje del saldo RCV, modalidad B" },
  { clave: "UMBRAL_DIFERENCIA_MODALIDAD", valor: "0.20", descripcion: "Diferencia de monto bajo la cual se resalta la modalidad que cuesta menos semanas" },
  { clave: "L97_SEMANAS_2021", valor: "750", tipo: "entero", descripcion: "Mínimo de semanas Ley 97 en 2021" },
  { clave: "L97_INCREMENTO_ANUAL", valor: "25", tipo: "entero", descripcion: "Incremento anual del mínimo Ley 97" },
  { clave: "L97_SEMANAS_TOPE", valor: "1000", tipo: "entero", descripcion: "Mínimo final Ley 97" },
  { clave: "L73_SEMANAS_MINIMAS", valor: "500", tipo: "entero", descripcion: "Mínimo de semanas Ley 73" },
  { clave: "L73_SEMANAS_CRITICAS", valor: "550", tipo: "entero", descripcion: "Debajo de esto, alerta crítica Ley 73" },
  { clave: "FOLIO_PREFIJO", valor: "RP-", tipo: "texto", descripcion: "Prefijo del folio (una sola serie por defecto)" },
  { clave: "FOLIO_ANCHO", valor: "4", tipo: "entero", descripcion: "Dígitos del folio" },
  { clave: "HORA_ALERTAS_CDMX", valor: "07:00", tipo: "texto", descripcion: "Hora de CDMX de la tarea diaria de alertas" },
  { clave: "HORA_CORREO_CDMX", valor: "07:15", tipo: "texto", descripcion: "Hora de CDMX del correo de resumen" },
  { clave: "ZONA_HORARIA", valor: "America/Mexico_City", tipo: "texto", descripcion: "Zona horaria del negocio" },
  { clave: "BASE_HONORARIO", valor: "neto", tipo: "texto", descripcion: "Decisión 14.3: el 30% se aplica sobre el depósito neto (neto | bruto)" },
  { clave: "BASE_COMISION_VENDEDOR", valor: "igual_honorario", tipo: "texto", descripcion: "Decisión 14.3: base del 5% del vendedor" },
  { clave: "BASE_REPARTO_SOCIO", valor: "subtotal", tipo: "texto", descripcion: "Decisión 14.3: reparto del socio sobre subtotal sin IVA (subtotal | total)" },
  { clave: "FALLEC_COMISION_INICIAL", valor: "3000", descripcion: "Comisión vendedor fallecimiento: pago inicial" },
  { clave: "FALLEC_COMISION_PCT_RECUPERADO", valor: "0.05", descripcion: "Comisión vendedor fallecimiento: % de lo recuperado" },
  { clave: "FALLEC_COMISION_MENSUALIDAD", valor: "3000", descripcion: "Comisión vendedor fallecimiento: primera mensualidad" },
  { clave: "ARCO_DIAS_RESPUESTA", valor: "20", tipo: "entero", descripcion: "Días para responder una solicitud ARCO" },
  { clave: "RETENCION_EXPEDIENTES_ANIOS", valor: "5", tipo: "entero", descripcion: "Conservación de expedientes de casos cerrados" },
  { clave: "PRIVACIDAD_VERSION", valor: "2026-10", tipo: "texto", descripcion: "Versión vigente del aviso de privacidad" },
  // Ligas oficiales de consulta. Son parámetros porque el gobierno cambia las direcciones.
  { clave: "LIGA_CONSULTA_CURP", valor: "https://www.gob.mx/curp/", tipo: "texto", descripcion: "Consulta de CURP (RENAPO)" },
  { clave: "LIGA_CONSULTA_NSS", valor: "https://serviciosdigitales.imss.gob.mx/gestionAsegurados-web-externo/asignacionNSS", tipo: "texto", descripcion: "Asignación o localización del NSS (IMSS)" },
  { clave: "LIGA_CONSULTA_SEMANAS", valor: "https://serviciosdigitales.imss.gob.mx/semanascotizadas-web/usuarios/IngresoAsegurado", tipo: "texto", descripcion: "Constancia de semanas cotizadas (IMSS)" },
];

// ───────────── Servicios (2.1) ─────────────
const SERVICIOS: Prisma.TipoServicioCreateInput[] = [
  { clave: "RETIRO_DESEMPLEO", nombre: "Retiro parcial por desempleo (art. 191-II LSS)", embudo: "retiro", forma_cobro: "30% de lo que paga la Afore, IVA incluido", honorario_pct: "0.30", notas: "Preferente para Ley 97 o cuando no afecta la pensión. Sin monto mínimo de retiro", orden: 1 },
  { clave: "PENSION_L73", nombre: "Asesoría de pensión Ley 73 (cesantía, vejez, invalidez)", embudo: "pension", forma_cobro: "Honorario fijo capturado por caso", notas: "Línea prioritaria del negocio", orden: 2 },
  { clave: "PENSION_L97", nombre: "Asesoría de pensión Ley 97", embudo: "pension", forma_cobro: "Honorario fijo", orden: 3 },
  { clave: "MODALIDAD_40", nombre: "Continuación voluntaria (arts. 218-221)", embudo: "pension", forma_cobro: "Honorario fijo", notas: "Requiere seguimiento mensual de pagos", orden: 4 },
  { clave: "PTI_M10", nombre: "Incorporación voluntaria / independiente", embudo: "pension", forma_cobro: "Honorario fijo", notas: "Ventana de 12 meses del art. 85 RACERF", orden: 5 },
  { clave: "FALLECIMIENTO", nombre: "Pensión de viudez/orfandad y recuperación de saldos", embudo: "pension", forma_cobro: "Honorario fijo + % de lo recuperado (configurable)", notas: "Esquema de comisión especial (sección 9)", orden: 6 },
  { clave: "DEVOLUCION_INFONAVIT", nombre: "Devolución de subcuenta de vivienda (DSSV)", embudo: "pension", forma_cobro: "Honorario fijo o % (configurable)", notas: "Trámite gratuito ante Infonavit: se vende la revisión y corrección", orden: 7 },
  { clave: "CORRECCION_NSS", nombre: "Unificación de NSS / corrección de semanas", embudo: "pension", forma_cobro: "Honorario fijo", orden: 8 },
];

// ───────────── Documentos (5.6) ─────────────
const TODOS = SERVICIOS.map((s) => s.clave);
const DOCUMENTOS: { nombre: string; servicios: string[]; vigencia_dias?: number; requiere_original?: boolean; obligatorio?: boolean; instrucciones?: string }[] = [
  { nombre: "Certificación de baja del IMSS", servicios: ["RETIRO_DESEMPLEO"], requiere_original: true },
  { nombre: "Comprobante de registro en Afore", servicios: ["RETIRO_DESEMPLEO"] },
  { nombre: "Identificación oficial (INE, cédula, pasaporte o cartilla)", servicios: TODOS },
  { nombre: "Comprobante de domicilio", servicios: TODOS, vigencia_dias: 90, instrucciones: "No mayor a 3 meses" },
  { nombre: "Estado de cuenta Afore", servicios: ["RETIRO_DESEMPLEO", "PENSION_L73", "PENSION_L97", "FALLECIMIENTO"] },
  { nombre: "Constancia de semanas cotizadas", servicios: ["RETIRO_DESEMPLEO", "PENSION_L73", "PENSION_L97", "MODALIDAD_40", "PTI_M10", "CORRECCION_NSS"] },
  { nombre: "Estado de cuenta bancario nivel 4", servicios: ["RETIRO_DESEMPLEO"], instrucciones: "A nombre del cliente; evita cuentas solo digitales" },
  { nombre: "Estado de cuenta bancario (DSSV)", servicios: ["DEVOLUCION_INFONAVIT"], vigencia_dias: 60, instrucciones: "No mayor a 2 meses" },
];
const INSTRUCCIONES_FOTO = "Foto a color, mínimo 256 KB, sin tachaduras";

const AFORES = [
  ["AZTECA", "Afore Azteca"], ["BANAMEX", "Afore Banamex"], ["COPPEL", "Afore Coppel"],
  ["INBURSA", "Afore Inbursa"], ["INVERCAP", "Afore Invercap"], ["PENSIONISSSTE", "PENSIONISSSTE"],
  ["PRINCIPAL", "Principal Afore"], ["PROFUTURO", "Profuturo Afore"], ["SURA", "Afore SURA"],
  ["XXI_BANORTE", "Afore XXI Banorte"],
] as const;

// Feriados oficiales (art. 74 LFT) en día hábil + días inhábiles bancarios (CNBV) que cierran Afores.
const INHABILES: [string, string, string][] = [
  ["2026-01-01", "Año Nuevo", "oficial"],
  ["2026-02-02", "Día de la Constitución", "oficial"],
  ["2026-03-16", "Natalicio de Benito Juárez", "oficial"],
  ["2026-04-02", "Jueves Santo", "bancario"],
  ["2026-04-03", "Viernes Santo", "bancario"],
  ["2026-05-01", "Día del Trabajo", "oficial"],
  ["2026-09-16", "Día de la Independencia", "oficial"],
  ["2026-11-02", "Día de Muertos", "bancario"],
  ["2026-11-16", "Día de la Revolución", "oficial"],
  ["2026-12-25", "Navidad", "oficial"],
  ["2027-01-01", "Año Nuevo", "oficial"],
  ["2027-02-01", "Día de la Constitución", "oficial"],
  ["2027-03-15", "Natalicio de Benito Juárez", "oficial"],
  ["2027-03-25", "Jueves Santo", "bancario"],
  ["2027-03-26", "Viernes Santo", "bancario"],
  ["2027-09-16", "Día de la Independencia", "oficial"],
  ["2027-11-02", "Día de Muertos", "bancario"],
  ["2027-11-15", "Día de la Revolución", "oficial"],
];

// ───────────── Esquemas de comisión (9.1) ─────────────
const ESQUEMAS: { nombre: string; tipo: "vendedor" | "referido" | "socio"; servicio: string | null; reglas: Prisma.InputJsonValue }[] = [
  { nombre: "Vendedor estándar", tipo: "vendedor", servicio: "RETIRO_DESEMPLEO",
    reglas: { tipo: "porcentaje", pct: 0.05, base: "monto_afore", devenga: "pago_afore_y_cobro" } },
  { nombre: "Vendedor estándar", tipo: "vendedor", servicio: "FALLECIMIENTO",
    reglas: { tipo: "compuesto", componentes: [
      { clave: "pago_inicial", fijo_param: "FALLEC_COMISION_INICIAL" },
      { clave: "recuperado", pct_param: "FALLEC_COMISION_PCT_RECUPERADO" },
      { clave: "primera_mensualidad", fijo_param: "FALLEC_COMISION_MENSUALIDAD" } ] } },
  { nombre: "Referidor", tipo: "referido", servicio: null,
    reglas: { tipo: "escalonado_mensual", cuenta: "honorario_cobrado", escalones: [
      { desde: 1, hasta: 2, monto: 1000 }, { desde: 3, hasta: 10, monto: 2000 }, { desde: 11, hasta: null, monto: 3000 } ] } },
  { nombre: "Socio licenciatario", tipo: "socio", servicio: "RETIRO_DESEMPLEO",
    reglas: { tipo: "reparto", costo_admin: 500, pct_socio: 0.4, base_param: "BASE_REPARTO_SOCIO" } },
];

// ───────────── Plantillas (8.3), en tuteo ─────────────
const PIE = "RetiroPorDesempleo.com · WhatsApp 56 6474 9567 · 800 611 1245";
const PLANTILLAS: [string, string, string][] = [
  ["BIENVENIDA", "Bienvenida y aviso de privacidad", `Hola {nombre}, gracias por contactarnos. Antes de revisar tu caso, lee nuestro aviso de privacidad: {liga_privacidad}. ${PIE}`],
  ["DOCS_PENDIENTES", "Documentos pendientes", `Hola {nombre}, para avanzar con tu trámite {folio} nos falta: {documentos}. Puedes mandarnos foto clara por aquí. ${PIE}`],
  ["FALTAN_DIAS", "Faltan N días para tu fecha", `Hola {nombre}, faltan {dias} días para que puedas retirar ({fecha}). Te avisamos ese día. ${PIE}`],
  ["YA_PUEDES_RETIRAR", "Ya puedes retirar", `Hola {nombre}, ya se cumplieron los 46 días desde tu baja. Ya podemos ingresar tu solicitud de retiro. ¿Agendamos? ${PIE}`],
  ["SOLICITUD_INGRESADA", "Solicitud ingresada", `Hola {nombre}, ingresamos tu solicitud {folio} a la Afore. La respuesta suele llegar en 5 días hábiles. ${PIE}`],
  ["AFORE_APROBO", "La Afore aprobó", `Hola {nombre}, ¡buenas noticias! La Afore aprobó tu retiro. Te avisamos en cuanto veas el depósito. ${PIE}`],
  ["RECORDATORIO_HONORARIO", "Recordatorio de pago de honorario", `Hola {nombre}, te recordamos el pago de nuestro honorario por {monto} (IVA incluido) del trámite {folio}. ${PIE}`],
  ["RECORDATORIO_M40", "Recordatorio de pago M40", `Hola {nombre}, tu pago de Modalidad 40 de {mes} vence el {fecha}. Recuerda que dos meses sin pago causan baja. ${PIE}`],
  ["SOLICITUD_REFERIDOS", "Solicitud de referidos", `Hola {nombre}, gracias por confiar en nosotros. Si conoces a alguien que se quedó sin empleo, compártele nuestro contacto. ${PIE}`],
];

async function main() {
  for (const p of PARAMETROS) {
    const vigente_desde = d(p.desde ?? "2026-01-01");
    await prisma.parametro.upsert({
      where: { clave_vigente_desde: { clave: p.clave, vigente_desde } },
      update: { valor: p.valor, descripcion: p.descripcion, tipo: p.tipo ?? "decimal", vigente_hasta: p.hasta ? d(p.hasta) : null },
      create: { clave: p.clave, valor: p.valor, tipo: p.tipo ?? "decimal", descripcion: p.descripcion, vigente_desde, vigente_hasta: p.hasta ? d(p.hasta) : null },
    });
  }

  for (const s of SERVICIOS) {
    await prisma.tipoServicio.upsert({ where: { clave: s.clave }, update: s, create: s });
  }

  for (const [orden, doc] of DOCUMENTOS.entries()) {
    const data = {
      nombre: doc.nombre,
      vigencia_dias: doc.vigencia_dias ?? null,
      requiere_original: doc.requiere_original ?? false,
      obligatorio: doc.obligatorio ?? true,
      instrucciones: [doc.instrucciones, INSTRUCCIONES_FOTO].filter(Boolean).join(". "),
      orden,
    };
    const tipo = await prisma.tipoDocumento.upsert({ where: { nombre: doc.nombre }, update: data, create: data });
    for (const servicio of doc.servicios) {
      await prisma.tipoDocumentoServicio.upsert({
        where: { tipo_documento_id_tipo_servicio: { tipo_documento_id: tipo.id, tipo_servicio: servicio } },
        update: {},
        create: { tipo_documento_id: tipo.id, tipo_servicio: servicio },
      });
    }
  }

  for (const [clave, nombre] of AFORES) {
    await prisma.afore.upsert({ where: { clave }, update: { nombre }, create: { clave, nombre } });
  }

  for (const [fecha, descripcion, origen] of INHABILES) {
    await prisma.diaInhabil.upsert({ where: { fecha: d(fecha) }, update: { descripcion, origen }, create: { fecha: d(fecha), descripcion, origen } });
  }

  for (const e of ESQUEMAS) {
    const existe = await prisma.esquemaComision.findFirst({ where: { nombre: e.nombre, tipo_servicio: e.servicio, version: 1 } });
    if (!existe) {
      await prisma.esquemaComision.create({
        data: { nombre: e.nombre, tipo: e.tipo, tipo_servicio: e.servicio, version: 1, reglas: e.reglas, vigente_desde: d("2026-01-01") },
      });
    }
  }

  for (const [clave, nombre, cuerpo] of PLANTILLAS) {
    await prisma.plantillaMensaje.upsert({ where: { clave }, update: { nombre }, create: { clave, nombre, cuerpo } });
  }

  console.log(
    `Seed listo: ${PARAMETROS.length} parámetros, ${SERVICIOS.length} servicios, ${DOCUMENTOS.length} documentos, ` +
      `${AFORES.length} Afores, ${INHABILES.length} días inhábiles, ${ESQUEMAS.length} esquemas, ${PLANTILLAS.length} plantillas.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
