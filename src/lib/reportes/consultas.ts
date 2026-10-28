// Reportes de la sección 10.8. Cada reporte es una consulta con RLS (Director y asesor) que
// devuelve columnas y renglones; la pantalla, el Excel y el PDF salen de la misma función.
// El periodo filtra por fecha de alta del caso (embudo) o por fecha de cobro (ingresos).
import "server-only";
import type { Sesion } from "@/lib/auth/sesion";
import { conUsuario, type Tx } from "@/lib/db/prisma";
import type { Columna } from "@/lib/exportar/excel";
import { NOMBRE_ETAPA, type Etapa } from "@/lib/reglas/etapas";

export type Fila = Record<string, string | number | null>;
export type Reporte = {
  clave: ClaveReporte;
  titulo: string;
  descripcion: string;
  columnas: Columna[];
  filas: Fila[];
  totales?: Record<string, number>;
  grafica?: { etiqueta: string; valor: string; formato: "pesos" | "numero" | "porcentaje" | "dias" };
};

export const REPORTES = [
  ["conversion_etapa", "Conversión por etapa"],
  ["conversion_origen", "Conversión por origen"],
  ["tiempo_etapa", "Tiempo promedio por etapa"],
  ["casos_afore", "Casos por Afore"],
  ["motivos_perdida", "Motivos de pérdida"],
  ["ingresos_servicio", "Ingresos por servicio"],
  ["ingresos_vendedor", "Ingresos por vendedor"],
  ["margen_canal", "Margen por canal"],
  ["regimen", "Distribución por régimen"],
  ["municipio", "Distribución por municipio"],
] as const;
export type ClaveReporte = (typeof REPORTES)[number][0];
export const esReporte = (v: string | undefined): v is ClaveReporte => REPORTES.some(([k]) => k === v);

export type Periodo = { desde: string; hasta: string };
const MOTIVO: Record<string, string> = {
  no_elegible: "No es elegible", no_conviene: "No le conviene", precio: "Precio", no_contesta: "No contesta", lo_hizo_solo: "Lo hizo por su cuenta", otro: "Otro",
};
const ORIGEN: Record<string, string> = {
  web: "Sitio web", whatsapp: "WhatsApp", llamada: "Llamada", referido: "Referido", vendedor: "Vendedor en campo", facebook: "Facebook", google: "Google", otro: "Otro",
};
const REGIMEN: Record<string, string> = { L73: "Ley 73", L97: "Ley 97", por_definir: "Por definir" };
const ORDEN_RETIRO: Etapa[] = ["PROSPECTO", "PRECALIFICADO", "CONTRATO", "EXPEDIENTE", "INGRESADA", "RESOLUCION", "PAGADO", "CERRADO"];

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 1000 : 0);
const num = (v: unknown) => Number(v ?? 0);

async function conversionEtapa(tx: Tx, p: Periodo): Promise<Reporte> {
  // Casos de retiro dados de alta en el periodo. Embudo acumulado: un caso que llegó a
  // "Contrato firmado" cuenta también en las etapas anteriores aunque se haya saltado alguna.
  const casos = await tx.$queryRaw<{ etapas: string[] }[]>`
    SELECT array_agg(DISTINCT h.etapa_nueva::text) AS etapas
    FROM historial_etapas h JOIN casos c ON c.id = h.caso_id
    WHERE c.tipo_servicio = 'RETIRO_DESEMPLEO' AND c.created_at::date BETWEEN ${p.desde}::date AND ${p.hasta}::date
    GROUP BY h.caso_id`;
  const maximo = casos.map((c) => Math.max(0, ...c.etapas.map((e) => ORDEN_RETIRO.indexOf(e as Etapa))));
  const llegaron = (i: number) => maximo.filter((m) => m >= i).length;
  return {
    clave: "conversion_etapa", titulo: "Conversión por etapa (retiro)", descripcion: "Casos de retiro dados de alta en el periodo que llegaron al menos a cada etapa, y su porcentaje sobre los prospectos.",
    columnas: [{ clave: "etapa", titulo: "Etapa", ancho: 26 }, { clave: "casos", titulo: "Casos", tipo: "numero" }, { clave: "pct", titulo: "% de prospectos", tipo: "porcentaje", ancho: 16 }],
    filas: ORDEN_RETIRO.map((e, i) => ({ etapa: NOMBRE_ETAPA[e], casos: llegaron(i), pct: pct(llegaron(i), casos.length) })),
    grafica: { etiqueta: "etapa", valor: "casos", formato: "numero" },
  };
}

async function conversionOrigen(tx: Tx, p: Periodo): Promise<Reporte> {
  const filas = await tx.$queryRaw<{ origen: string; casos: number; contratos: number; cobrados: number }[]>`
    SELECT pe.origen::text AS origen, count(*)::int AS casos,
      count(*) FILTER (WHERE c.fecha_contrato IS NOT NULL)::int AS contratos,
      count(*) FILTER (WHERE EXISTS (SELECT 1 FROM cobros k WHERE k.caso_id = c.id AND k.estado = 'cobrado' AND k.archivado_at IS NULL))::int AS cobrados
    FROM casos c JOIN personas pe ON pe.id = c.persona_id
    WHERE c.created_at::date BETWEEN ${p.desde}::date AND ${p.hasta}::date AND c.archivado_at IS NULL
    GROUP BY 1 ORDER BY 2 DESC`;
  return {
    clave: "conversion_origen", titulo: "Conversión por origen", descripcion: "De los casos dados de alta en el periodo: cuántos firmaron contrato y cuántos ya pagaron honorario, por origen.",
    columnas: [{ clave: "origen", titulo: "Origen", ancho: 20 }, { clave: "casos", titulo: "Casos", tipo: "numero" }, { clave: "contratos", titulo: "Contratos", tipo: "numero" },
      { clave: "cobrados", titulo: "Con honorario cobrado", tipo: "numero", ancho: 20 }, { clave: "conversion", titulo: "Conversión", tipo: "porcentaje", ancho: 12 }],
    filas: filas.map((f) => ({ origen: ORIGEN[f.origen] ?? f.origen, casos: f.casos, contratos: f.contratos, cobrados: f.cobrados, conversion: pct(f.cobrados, f.casos) })),
    totales: { casos: filas.reduce((a, f) => a + f.casos, 0), contratos: filas.reduce((a, f) => a + f.contratos, 0), cobrados: filas.reduce((a, f) => a + f.cobrados, 0) },
    grafica: { etiqueta: "origen", valor: "conversion", formato: "porcentaje" },
  };
}

async function tiempoEtapa(tx: Tx, p: Periodo): Promise<Reporte> {
  // Días entre entrar a una etapa y salir de ella (la siguiente entrada del mismo caso).
  // Solo cuenta estancias terminadas que empezaron en el periodo.
  const filas = await tx.$queryRaw<{ etapa: string; n: number; promedio: number; maximo: number }[]>`
    WITH h AS (
      SELECT etapa_nueva, fecha, lead(fecha) OVER (PARTITION BY caso_id ORDER BY fecha) AS salida
      FROM historial_etapas
    )
    SELECT etapa_nueva::text AS etapa, count(*)::int AS n,
      round(avg(extract(epoch FROM salida - fecha) / 86400)::numeric, 1)::float AS promedio,
      round(max(extract(epoch FROM salida - fecha) / 86400)::numeric, 1)::float AS maximo
    FROM h WHERE salida IS NOT NULL AND fecha::date BETWEEN ${p.desde}::date AND ${p.hasta}::date
    GROUP BY 1`;
  const orden = (e: string) => { const i = ORDEN_RETIRO.indexOf(e as Etapa); return i < 0 ? 99 : i; };
  return {
    clave: "tiempo_etapa", titulo: "Tiempo promedio por etapa", descripcion: "Días que pasa un caso en cada etapa antes de moverse (solo estancias que ya terminaron).",
    columnas: [{ clave: "etapa", titulo: "Etapa", ancho: 26 }, { clave: "n", titulo: "Casos", tipo: "numero" }, { clave: "promedio", titulo: "Días promedio", tipo: "numero", ancho: 14 }, { clave: "maximo", titulo: "Máximo", tipo: "numero" }],
    filas: [...filas].sort((a, b) => orden(a.etapa) - orden(b.etapa)).map((f) => ({ etapa: NOMBRE_ETAPA[f.etapa as Etapa] ?? f.etapa, n: f.n, promedio: f.promedio, maximo: f.maximo })),
    grafica: { etiqueta: "etapa", valor: "promedio", formato: "dias" },
  };
}

async function conteo(tx: Tx, p: Periodo, campo: "afore" | "motivo" | "regimen" | "municipio") {
  const desde = p.desde, hasta = p.hasta;
  switch (campo) {
    case "afore": return tx.$queryRaw<{ k: string | null; n: number }[]>`
      SELECT coalesce(a.nombre, d.afore) AS k, count(*)::int AS n FROM casos c LEFT JOIN datos_afore d ON d.caso_id = c.id LEFT JOIN afores a ON a.clave = d.afore
      WHERE c.created_at::date BETWEEN ${desde}::date AND ${hasta}::date AND c.archivado_at IS NULL AND c.tipo_servicio = 'RETIRO_DESEMPLEO' GROUP BY 1 ORDER BY 2 DESC`;
    case "motivo": return tx.$queryRaw<{ k: string | null; n: number }[]>`
      SELECT c.motivo_perdida::text AS k, count(*)::int AS n FROM casos c
      WHERE c.etapa = 'PERDIDO' AND c.etapa_desde::date BETWEEN ${desde}::date AND ${hasta}::date GROUP BY 1 ORDER BY 2 DESC`;
    case "regimen": return tx.$queryRaw<{ k: string | null; n: number }[]>`
      SELECT d.regimen::text AS k, count(*)::int AS n FROM casos c LEFT JOIN datos_imss d ON d.caso_id = c.id
      WHERE c.created_at::date BETWEEN ${desde}::date AND ${hasta}::date AND c.archivado_at IS NULL GROUP BY 1 ORDER BY 2 DESC`;
    case "municipio": return tx.$queryRaw<{ k: string | null; n: number }[]>`
      SELECT nullif(trim(pe.municipio), '') AS k, count(*)::int AS n FROM casos c JOIN personas pe ON pe.id = c.persona_id
      WHERE c.created_at::date BETWEEN ${desde}::date AND ${hasta}::date AND c.archivado_at IS NULL GROUP BY 1 ORDER BY 2 DESC`;
  }
}

function distribucion(clave: ClaveReporte, titulo: string, descripcion: string, nombre: string, filas: { k: string | null; n: number }[], etiqueta: (k: string | null) => string, tope = 0): Reporte {
  let lista = filas.map((f) => ({ k: etiqueta(f.k), n: f.n }));
  if (tope && lista.length > tope) {
    const resto = lista.slice(tope).reduce((a, f) => a + f.n, 0);
    lista = [...lista.slice(0, tope), { k: "Otros", n: resto }];
  }
  const total = lista.reduce((a, f) => a + f.n, 0);
  return {
    clave, titulo, descripcion,
    columnas: [{ clave: "k", titulo: nombre, ancho: 28 }, { clave: "n", titulo: "Casos", tipo: "numero" }, { clave: "pct", titulo: "%", tipo: "porcentaje" }],
    filas: lista.map((f) => ({ k: f.k, n: f.n, pct: pct(f.n, total) })),
    totales: { n: total },
    grafica: { etiqueta: "k", valor: "n", formato: "numero" },
  };
}

async function ingresos(tx: Tx, p: Periodo, por: "servicio" | "vendedor"): Promise<Reporte> {
  const filas = por === "servicio"
    ? await tx.$queryRaw<{ k: string; cobros: number; casos: number; total: number; subtotal: number; iva: number }[]>`
        SELECT t.nombre AS k, count(*)::int AS cobros, count(DISTINCT c.id)::int AS casos, sum(k.honorario_total)::float AS total, sum(k.subtotal)::float AS subtotal, sum(k.iva)::float AS iva
        FROM cobros k JOIN casos c ON c.id = k.caso_id JOIN tipos_servicio t ON t.clave = c.tipo_servicio
        WHERE k.estado = 'cobrado' AND k.archivado_at IS NULL AND k.fecha_cobro BETWEEN ${p.desde}::date AND ${p.hasta}::date GROUP BY 1 ORDER BY 4 DESC`
    : await tx.$queryRaw<{ k: string; cobros: number; casos: number; total: number; subtotal: number; iva: number }[]>`
        SELECT coalesce(u.nombre, 'Sin vendedor (directo)') AS k, count(*)::int AS cobros, count(DISTINCT c.id)::int AS casos, sum(k.honorario_total)::float AS total, sum(k.subtotal)::float AS subtotal, sum(k.iva)::float AS iva
        FROM cobros k JOIN casos c ON c.id = k.caso_id LEFT JOIN usuarios u ON u.id = c.vendedor_id
        WHERE k.estado = 'cobrado' AND k.archivado_at IS NULL AND k.fecha_cobro BETWEEN ${p.desde}::date AND ${p.hasta}::date GROUP BY 1 ORDER BY 4 DESC`;
  const centavos = (k: "total" | "subtotal" | "iva") => Math.round(filas.reduce((a, f) => a + Math.round(num(f[k]) * 100), 0)) / 100;
  return {
    clave: por === "servicio" ? "ingresos_servicio" : "ingresos_vendedor",
    titulo: por === "servicio" ? "Ingresos por servicio" : "Ingresos por vendedor",
    descripcion: "Honorarios cobrados en el periodo (por fecha de cobro), con subtotal e IVA.",
    columnas: [{ clave: "k", titulo: por === "servicio" ? "Servicio" : "Vendedor", ancho: 34 }, { clave: "casos", titulo: "Casos", tipo: "numero" }, { clave: "cobros", titulo: "Cobros", tipo: "numero" },
      { clave: "total", titulo: "Honorario", tipo: "pesos", ancho: 16 }, { clave: "subtotal", titulo: "Subtotal", tipo: "pesos", ancho: 16 }, { clave: "iva", titulo: "IVA", tipo: "pesos", ancho: 14 }],
    filas: filas.map((f) => ({ k: f.k, casos: f.casos, cobros: f.cobros, total: num(f.total), subtotal: num(f.subtotal), iva: num(f.iva) })),
    totales: { casos: filas.reduce((a, f) => a + f.casos, 0), cobros: filas.reduce((a, f) => a + f.cobros, 0), total: centavos("total"), subtotal: centavos("subtotal"), iva: centavos("iva") },
    grafica: { etiqueta: "k", valor: "total", formato: "pesos" },
  };
}

async function margenCanal(tx: Tx, p: Periodo): Promise<Reporte> {
  // Canal del caso: socio > vendedor > referidor > directo. Margen = honorario − IVA − comisiones (9.3).
  const filas = await tx.$queryRaw<{ canal: string; casos: number; honorario: number; iva: number; comisiones: number }[]>`
    WITH cob AS (
      SELECT caso_id, sum(honorario_total) AS honorario, sum(iva) AS iva FROM cobros
      WHERE estado = 'cobrado' AND archivado_at IS NULL AND fecha_cobro BETWEEN ${p.desde}::date AND ${p.hasta}::date GROUP BY 1
    ), com AS (
      SELECT k.caso_id, sum(k.monto) AS comisiones FROM comisiones k JOIN cob ON cob.caso_id = k.caso_id
      WHERE k.estado IN ('devengada', 'pagada') AND k.archivado_at IS NULL GROUP BY 1
    )
    SELECT CASE WHEN c.socio_id IS NOT NULL THEN 'Socio licenciatario' WHEN c.vendedor_id IS NOT NULL THEN 'Vendedor'
                WHEN c.referidor_id IS NOT NULL THEN 'Referidor' ELSE 'Directo' END AS canal,
      count(*)::int AS casos, sum(cob.honorario)::float AS honorario, sum(cob.iva)::float AS iva, coalesce(sum(com.comisiones), 0)::float AS comisiones
    FROM cob JOIN casos c ON c.id = cob.caso_id LEFT JOIN com ON com.caso_id = cob.caso_id
    GROUP BY 1 ORDER BY 3 DESC`;
  const r = filas.map((f) => {
    const margen = (Math.round(num(f.honorario) * 100) - Math.round(num(f.iva) * 100) - Math.round(num(f.comisiones) * 100)) / 100;
    const neto = num(f.honorario) - num(f.iva);
    return { canal: f.canal, casos: f.casos, honorario: num(f.honorario), iva: num(f.iva), comisiones: num(f.comisiones), margen, pct: neto ? Math.round((margen / neto) * 1000) / 1000 : 0 };
  });
  const suma = (k: "honorario" | "iva" | "comisiones" | "margen") => Math.round(r.reduce((a, f) => a + Math.round(f[k] * 100), 0)) / 100;
  return {
    clave: "margen_canal", titulo: "Margen por canal", descripcion: "Honorario cobrado en el periodo − IVA − comisiones devengadas o pagadas de esos casos. % sobre el subtotal.",
    columnas: [{ clave: "canal", titulo: "Canal", ancho: 22 }, { clave: "casos", titulo: "Casos", tipo: "numero" }, { clave: "honorario", titulo: "Honorario", tipo: "pesos", ancho: 16 },
      { clave: "iva", titulo: "IVA", tipo: "pesos", ancho: 14 }, { clave: "comisiones", titulo: "Comisiones", tipo: "pesos", ancho: 16 }, { clave: "margen", titulo: "Margen", tipo: "pesos", ancho: 16 }, { clave: "pct", titulo: "% margen", tipo: "porcentaje" }],
    filas: r,
    totales: { casos: r.reduce((a, f) => a + f.casos, 0), honorario: suma("honorario"), iva: suma("iva"), comisiones: suma("comisiones"), margen: suma("margen") },
    grafica: { etiqueta: "canal", valor: "margen", formato: "pesos" },
  };
}

export async function generarReporte(s: Sesion, clave: ClaveReporte, p: Periodo): Promise<Reporte> {
  return conUsuario(s.claims, async (tx) => {
    switch (clave) {
      case "conversion_etapa": return conversionEtapa(tx, p);
      case "conversion_origen": return conversionOrigen(tx, p);
      case "tiempo_etapa": return tiempoEtapa(tx, p);
      case "casos_afore": return distribucion(clave, "Casos por Afore", "Casos de retiro dados de alta en el periodo, por Afore del cliente.", "Afore", await conteo(tx, p, "afore"), (k) => k ?? "Sin capturar");
      case "motivos_perdida": return distribucion(clave, "Motivos de pérdida", "Casos que pasaron a «Perdido» en el periodo, por motivo.", "Motivo", await conteo(tx, p, "motivo"), (k) => (k ? MOTIVO[k] ?? k : "Sin motivo"));
      case "ingresos_servicio": return ingresos(tx, p, "servicio");
      case "ingresos_vendedor": return ingresos(tx, p, "vendedor");
      case "margen_canal": return margenCanal(tx, p);
      case "regimen": return distribucion(clave, "Distribución por régimen", "Casos dados de alta en el periodo, por régimen del IMSS.", "Régimen", await conteo(tx, p, "regimen"), (k) => (k ? REGIMEN[k] ?? k : "Sin datos IMSS"));
      case "municipio": return distribucion(clave, "Distribución por municipio", "Casos dados de alta en el periodo, por municipio del cliente (los 15 primeros).", "Municipio", await conteo(tx, p, "municipio"), (k) => k ?? "Sin capturar", 15);
    }
  }, s.ip);
}
