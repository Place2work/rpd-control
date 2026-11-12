"use server";

// Lectura automática de la constancia de semanas (12-nov-2026): se lee el PDF del expediente, se compara con el
// cliente (NSS y CURP) y, con confirmación, se pasan los datos a IMSS y Afore. Todo con RLS; queda en Seguimiento.
import { revalidatePath } from "next/cache";
import { obtenerSesion } from "@/lib/auth/sesion";
import { leerConstanciaGuardada } from "@/lib/constancia/leer";
import { cifrar, hashIdentificador } from "@/lib/cripto";
import { conUsuario } from "@/lib/db/prisma";
import { mxn } from "@/lib/formato";
import type { LecturaConstancia } from "@/lib/reglas/constancia";
import { bimestresEntre, regimenPorPrimeraAlta } from "@/lib/reglas/fechas";
import { curpParcial, datosDeCurp } from "@/lib/reglas/identificadores";

type Identidad = "coincide" | "distinto" | "sin_dato" | "no_viene";
export type CampoConstancia = { clave: string; etiqueta: string; constancia: string; caso: string; cambia: boolean; noMarcar?: boolean };
export type VistaConstancia = {
  error?: string;
  lectura?: Omit<LecturaConstancia, "nss" | "curp"> & { nssFin: string | null; curpParcial: string | null };
  identidad?: { nss: Identidad; curp: Identidad };
  campos?: CampoConstancia[];
};

const dia = (v: string) => new Date(`${v}T00:00:00Z`);
const isoDe = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
const larga = (v: string | null) => (v ? new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeZone: "UTC" }).format(dia(v)) : "—");
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const REGIMEN: Record<string, string> = { L73: "Ley 73", L97: "Ley 97", por_definir: "Por definir" };
const txtNum = (v: number | null) => (v === null ? "—" : v.toLocaleString("es-MX"));

type Contexto = {
  lectura: LecturaConstancia; personaId: string; nssHash: string | null; curpHash: string | null;
  imss: { fecha_constancia: Date | null; semanas_cotizadas: unknown; semanas_descontadas: unknown; semanas_reintegradas: unknown; fecha_baja: Date | null;
    fecha_primera_alta: Date | null; sbc_ultimo: unknown; ultimo_patron: string | null; cotiza_actualmente: boolean; regimen: string; regimen_justificacion: string | null; bimestres_cotizados: number | null } | null;
};

async function contexto(casoId: string, documentoId: string): Promise<{ ctx?: Contexto; error?: string }> {
  const { claims, ip, usuario } = await obtenerSesion();
  if (usuario.rol === "vendedor") return { error: "Tu rol no ve los documentos del expediente." };
  const datos = await conUsuario(claims, async (tx) => {
    const doc = await tx.documento.findFirst({ where: { id: documentoId, caso_id: casoId, archivado_at: null }, select: { archivo_path: true, archivo_mime: true } });
    const caso = await tx.caso.findUnique({ where: { id: casoId }, select: {
      persona: { select: { id: true, nss_hash: true, curp_hash: true } },
      datos_imss: { select: { fecha_constancia: true, semanas_cotizadas: true, semanas_descontadas: true, semanas_reintegradas: true, fecha_baja: true,
        fecha_primera_alta: true, sbc_ultimo: true, ultimo_patron: true, cotiza_actualmente: true, regimen: true, regimen_justificacion: true, bimestres_cotizados: true } },
    } });
    return { doc, caso };
  }, ip);
  if (!datos.doc?.archivo_path || !datos.caso) return { error: "No encontramos el documento." };
  if (datos.doc.archivo_mime !== "application/pdf") return { error: "Solo se leen constancias en PDF (como las descarga el IMSS). Una foto se captura a mano." };
  const r = await leerConstanciaGuardada(datos.doc.archivo_path);
  if (!r.lectura) return { error: r.error };
  return { ctx: { lectura: r.lectura, personaId: datos.caso.persona.id, nssHash: datos.caso.persona.nss_hash, curpHash: datos.caso.persona.curp_hash, imss: datos.caso.datos_imss } };
}

function identidad(ctx: Contexto) {
  const una = (tipo: "nss" | "curp", valor: string | null, hash: string | null): Identidad =>
    !valor ? "no_viene" : !hash ? "sin_dato" : hashIdentificador(tipo, valor) === hash ? "coincide" : "distinto";
  return { nss: una("nss", ctx.lectura.nss, ctx.nssHash), curp: una("curp", ctx.lectura.curp, ctx.curpHash) };
}

function campos(ctx: Contexto): CampoConstancia[] {
  const l = ctx.lectura, i = ctx.imss;
  const fila = (clave: string, etiqueta: string, constancia: string, caso: string, hay: boolean) =>
    hay ? [{ clave, etiqueta, constancia, caso, cambia: constancia !== caso }] : [];
  return [
    ...fila("fecha_constancia", "Fecha de la constancia", larga(l.fechaEmision), larga(isoDe(i?.fecha_constancia)), Boolean(l.fechaEmision)),
    ...fila("semanas_cotizadas", "Semanas cotizadas", txtNum(l.cotizadas), txtNum(num(i?.semanas_cotizadas)), l.cotizadas !== null),
    ...fila("semanas_descontadas", "Semanas descontadas", txtNum(l.descontadas), txtNum(num(i?.semanas_descontadas)), l.descontadas !== null),
    ...fila("semanas_reintegradas", "Semanas reintegradas", txtNum(l.reintegradas), txtNum(num(i?.semanas_reintegradas)), l.reintegradas !== null),
    ...fila("fecha_baja", "Fecha de baja", larga(l.fechaBaja), larga(isoDe(i?.fecha_baja)), Boolean(l.fechaBaja)),
    ...fila("fecha_primera_alta", "Primera alta en el IMSS", larga(l.primeraAlta), larga(isoDe(i?.fecha_primera_alta)), Boolean(l.primeraAlta)),
    // Régimen automático por la primera alta; si en el caso se cambió a mano con justificación, no se marca solo.
    ...fila("regimen", "Régimen (por la primera alta)", REGIMEN[l.regimen ?? ""] ?? "—", REGIMEN[i?.regimen ?? ""] ?? "—", Boolean(l.regimen))
      .map((c) => ({ ...c, noMarcar: Boolean(i?.regimen_justificacion) && c.cambia })),
    ...fila("sbc_ultimo", "Último salario base (diario)", l.sbcUltimo === null ? "—" : mxn(l.sbcUltimo), num(i?.sbc_ultimo) === null ? "—" : mxn(num(i?.sbc_ultimo)), l.sbcUltimo !== null),
    ...fila("ultimo_patron", "Último patrón", l.ultimoPatron ?? "—", i?.ultimo_patron ?? "—", Boolean(l.ultimoPatron)),
    ...fila("cotiza_actualmente", "¿Cotiza actualmente?", l.cotizaActualmente ? "Sí" : "No", i ? (i.cotiza_actualmente ? "Sí" : "No") : "—", true),
  ];
}

export async function verConstancia(casoId: string, documentoId: string): Promise<VistaConstancia> {
  const { ctx, error } = await contexto(casoId, documentoId);
  if (!ctx) return { error };
  const { nss, curp, ...resto } = ctx.lectura;
  return {
    lectura: { ...resto, nssFin: nss ? nss.slice(-4) : null, curpParcial: curp ? curpParcial(curp) : null },
    identidad: identidad(ctx), campos: campos(ctx),
  };
}

export async function aplicarConstancia(casoId: string, documentoId: string, elegidos: string[]): Promise<{ ok?: boolean; error?: string }> {
  const { claims, ip, usuario } = await obtenerSesion();
  const { ctx, error } = await contexto(casoId, documentoId);
  if (!ctx) return { error };
  const id = identidad(ctx);
  if (id.nss === "distinto" || id.curp === "distinto") return { error: "El NSS o la CURP de la constancia no son los de este cliente. Revisa que sea el documento correcto." };
  const l = ctx.lectura;
  const quiere = (k: string) => elegidos.includes(k);
  const data: Record<string, unknown> = {};
  if (quiere("fecha_constancia") && l.fechaEmision) data.fecha_constancia = dia(l.fechaEmision);
  if (quiere("semanas_cotizadas") && l.cotizadas !== null) data.semanas_cotizadas = l.cotizadas;
  if (quiere("semanas_descontadas") && l.descontadas !== null) data.semanas_descontadas = l.descontadas;
  if (quiere("semanas_reintegradas") && l.reintegradas !== null) data.semanas_reintegradas = l.reintegradas;
  if (quiere("fecha_baja") && l.fechaBaja) data.fecha_baja = dia(l.fechaBaja);
  if (quiere("fecha_primera_alta") && l.primeraAlta) data.fecha_primera_alta = dia(l.primeraAlta);
  if (quiere("sbc_ultimo") && l.sbcUltimo !== null) data.sbc_ultimo = l.sbcUltimo;
  if (quiere("ultimo_patron") && l.ultimoPatron) data.ultimo_patron = l.ultimoPatron;
  if (quiere("cotiza_actualmente")) data.cotiza_actualmente = l.cotizaActualmente;
  if (quiere("regimen") && l.regimen) { data.regimen = l.regimen; data.regimen_justificacion = null; }
  const guardarNss = quiere("guardar_nss") && id.nss === "sin_dato" && l.nss;
  const guardarCurp = quiere("guardar_curp") && id.curp === "sin_dato" && l.curp;
  if (!Object.keys(data).length && !guardarNss && !guardarCurp) return { error: "Marca al menos un dato para pasar." };

  // Derivados, igual que al guardar IMSS a mano: semanas totales, régimen sugerido y bimestres por fechas.
  const previo = ctx.imss;
  const valor = (k: string, actual: unknown) => (k in data ? data[k] : actual);
  const cot = num(valor("semanas_cotizadas", previo?.semanas_cotizadas));
  if (cot !== null) data.semanas_totales = cot - (num(valor("semanas_descontadas", previo?.semanas_descontadas)) ?? 0) + (num(valor("semanas_reintegradas", previo?.semanas_reintegradas)) ?? 0);
  const alta = isoDe(valor("fecha_primera_alta", previo?.fecha_primera_alta) as Date | null);
  const baja = isoDe(valor("fecha_baja", previo?.fecha_baja) as Date | null);
  if (!("regimen" in data) && alta && (!previo || previo.regimen === "por_definir")) data.regimen = regimenPorPrimeraAlta(alta);
  if (alta && baja && (previo?.bimestres_cotizados ?? null) === null) data.bimestres_cotizados = bimestresEntre(alta, baja);

  const bajaPrev = isoDe(previo?.fecha_baja);
  try {
    await conUsuario(claims, async (tx) => {
      await tx.datosImss.upsert({ where: { caso_id: casoId }, update: data, create: { caso_id: casoId, ...data }, select: { id: true } });
      if (guardarNss || guardarCurp) {
        const p: Record<string, unknown> = {};
        if (guardarNss && l.nss) Object.assign(p, { nss_cifrado: cifrar(l.nss), nss_hash: hashIdentificador("nss", l.nss), nss_ultimos4: l.nss.slice(-4) });
        if (guardarCurp && l.curp) {
          const deCurp = datosDeCurp(l.curp);
          Object.assign(p, { curp_cifrada: cifrar(l.curp), curp_hash: hashIdentificador("curp", l.curp), curp_parcial: curpParcial(l.curp), fecha_nacimiento: dia(deCurp.fechaNacimiento), sexo: deCurp.sexo });
        }
        await tx.persona.update({ where: { id: ctx.personaId }, data: p, select: { id: true } });
      }
      if ("fecha_baja" in data && bajaPrev !== l.fechaBaja && bajaPrev) {
        await tx.alerta.updateMany({ where: { caso_id: casoId, regla: { in: ["DIA46_PROXIMO", "DIA46_HOY", "TRAMITE_LISTO"] }, estado: { in: ["activa", "pospuesta"] } },
          data: { estado: "descartada" } });
      }
      const nombres = campos(ctx).filter((c) => quiere(c.clave)).map((c) => `${c.etiqueta.toLowerCase()} ${c.constancia}`);
      if (guardarNss) nombres.push("NSS del cliente");
      if (guardarCurp) nombres.push("CURP del cliente");
      await tx.evento.create({ data: { caso_id: casoId, tipo: "documento", usuario_id: usuario.id,
        datos: { campo: "constancia_leida", documento_id: documentoId, folio: l.folio, campos: elegidos },
        texto: `Se leyó la constancia de semanas${l.fechaEmision ? ` del ${larga(l.fechaEmision)}` : ""} y se pasó a IMSS y Afore: ${nombres.join("; ")}.` } });
    }, ip);
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return { error: "Ese NSS o esa CURP ya pertenecen a otra persona." };
    console.error("[constancia]", e);
    return { error: "No se pudo guardar." };
  }
  revalidatePath(`/casos/${casoId}`);
  return { ok: true };
}
