"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { obtenerSesion } from "@/lib/auth/sesion";
import { fotoDelCaso } from "@/lib/casos/foto";
import { cifrar, hashIdentificador } from "@/lib/cripto";
import { conUsuario } from "@/lib/db/prisma";
import { verDatoSensible } from "@/lib/db/sensibles";
import { parametrosFechas } from "@/lib/parametros";
import { normalizarWhatsapp } from "@/lib/prospectos/validacion";
import { NOMBRE_ETAPA, validarTransicion, type Etapa } from "@/lib/reglas/etapas";
import { diasEntre, regimenPorPrimeraAlta, sumarDiasHabiles, vencimientoContrato } from "@/lib/reglas/fechas";
import { curpParcial, datosDeCurp, validarCurp, validarNss } from "@/lib/reglas/identificadores";
import { hoyCDMX } from "@/lib/tiempo";

export type Resultado = { ok?: boolean; error?: string; errores?: Record<string, string>; faltantes?: string[] };

const fecha = (iso: string) => new Date(`${iso}T00:00:00Z`);
const texto = (form: FormData, k: string) => {
  const v = form.get(k);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
};
const marcado = (form: FormData, k: string) => form.get(k) === "si";
const decimal = (v: string | null) => (v === null ? null : Number(v.replace(/[,$\s]/g, "")));
const esFecha = (v: string | null) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v);

function erroresDe(e: z.ZodError): Record<string, string> {
  const r: Record<string, string> = {};
  for (const i of e.issues) r[String(i.path[0])] ??= i.message;
  return r;
}

// ───────────── Datos sensibles y notas ─────────────

// "Ver completo" (sección 3): la base valida el rol y deja renglón VER_SENSIBLE en la bitácora.
export async function verIdentificador(personaId: string, campo: "curp" | "nss"): Promise<{ valor?: string; error?: string }> {
  const { claims, ip, usuario } = await obtenerSesion();
  if (usuario.rol === "vendedor") return { error: "Tu rol solo ve el dato enmascarado." };
  try {
    const valor = await verDatoSensible(claims, { tabla: "personas", campo }, personaId, ip);
    return valor ? { valor } : { error: "No está capturado." };
  } catch {
    return { error: "No tienes acceso a este dato." };
  }
}

export async function agregarNota(casoId: string, _previo: Resultado, form: FormData): Promise<Resultado> {
  const { claims, ip, usuario } = await obtenerSesion();
  const nota = texto(form, "texto");
  const tipo = String(form.get("tipo") ?? "nota");
  if (!nota || nota.length < 2) return { error: "Escribe la nota." };
  if (!["nota", "llamada", "whatsapp", "correo"].includes(tipo)) return { error: "Tipo no válido." };
  try {
    await conUsuario(
      claims,
      (tx) => tx.evento.create({ data: { caso_id: casoId, tipo: tipo as "nota", texto: nota.slice(0, 2000), usuario_id: usuario.id } }),
      ip,
    );
  } catch {
    return { error: "No se pudo guardar la nota." };
  }
  revalidatePath(`/casos/${casoId}`);
  return { ok: true };
}

// ───────────── Datos personales ─────────────

const esquemaPersona = z.object({
  nombre: z.string().trim().min(2, "Escribe el nombre"),
  whatsapp: z.string().refine((v) => normalizarWhatsapp(v) !== null, "Escribe 10 dígitos"),
  email: z.string().email("Correo no válido").nullable(),
  curp: z.string().nullable().refine((v) => !v || validarCurp(v).valido, "CURP no válida"),
  nss: z.string().nullable().refine((v) => !v || validarNss(v).valido, "NSS no válido"),
});

export async function guardarDatosPersonales(casoId: string, personaId: string, _p: Resultado, form: FormData): Promise<Resultado> {
  const { claims, ip } = await obtenerSesion();
  const r = esquemaPersona.safeParse({
    nombre: form.get("nombre") ?? "",
    whatsapp: form.get("whatsapp") ?? "",
    email: texto(form, "email"),
    curp: texto(form, "curp"),
    nss: texto(form, "nss"),
  });
  if (!r.success) return { errores: erroresDe(r.error) };
  const d = r.data;
  const wa = normalizarWhatsapp(d.whatsapp)!;
  const data: Prisma.PersonaUpdateInput = {
    nombre: d.nombre,
    apellido_paterno: texto(form, "apellido_paterno"),
    apellido_materno: texto(form, "apellido_materno"),
    whatsapp: wa,
    telefono: wa,
    email: d.email,
    municipio: texto(form, "municipio"),
    estado: texto(form, "estado"),
    estado_civil: (texto(form, "estado_civil") as Prisma.PersonaUpdateInput["estado_civil"]) ?? null,
    beneficiarios_designados: (texto(form, "beneficiarios_designados") ?? "no_sabe") as "si" | "no" | "no_sabe",
  };
  // CURP y NSS solo se reemplazan si se escribe uno nuevo (el actual nunca viaja al navegador).
  if (d.curp) {
    const curp = validarCurp(d.curp).valor;
    const deCurp = datosDeCurp(curp);
    Object.assign(data, {
      curp_cifrada: cifrar(curp), curp_hash: hashIdentificador("curp", curp), curp_parcial: curpParcial(curp),
      fecha_nacimiento: fecha(deCurp.fechaNacimiento), sexo: deCurp.sexo,
    });
  }
  if (d.nss) {
    const nss = validarNss(d.nss).valor;
    Object.assign(data, { nss_cifrado: cifrar(nss), nss_hash: hashIdentificador("nss", nss), nss_ultimos4: nss.slice(-4) });
  }
  if (marcado(form, "privacidad")) {
    const actual = await conUsuario(claims, (tx) => tx.persona.findUnique({ where: { id: personaId }, select: { privacidad_aceptada_at: true } }), ip);
    if (!actual?.privacidad_aceptada_at) Object.assign(data, { privacidad_aceptada_at: new Date(), privacidad_ip: ip });
  }
  try {
    await conUsuario(claims, (tx) => tx.persona.update({ where: { id: personaId }, data, select: { id: true } }), ip);
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return { error: "Esa CURP o ese NSS ya pertenecen a otra persona." };
    return { error: "No se pudo guardar." };
  }
  revalidatePath(`/casos/${casoId}`);
  return { ok: true };
}

// ───────────── IMSS y Afore ─────────────

export async function guardarImss(casoId: string, _p: Resultado, form: FormData): Promise<Resultado> {
  const { claims, ip } = await obtenerSesion();
  const fechas = ["fecha_primera_alta", "fecha_constancia", "fecha_baja"] as const;
  const errores: Record<string, string> = {};
  for (const f of fechas) if (!esFecha(texto(form, f))) errores[f] = "Fecha no válida";
  const numeros = ["semanas_cotizadas", "semanas_descontadas", "semanas_reintegradas", "bimestres_cotizados", "sbc_ultimo", "sbc_promedio_250"] as const;
  const n: Record<string, number | null> = {};
  for (const k of numeros) {
    n[k] = decimal(texto(form, k));
    if (n[k] !== null && (!Number.isFinite(n[k]) || n[k]! < 0)) errores[k] = "Número no válido";
  }

  // Régimen (5.3): sale de la primera alta; cambiarlo a mano exige justificación.
  const primeraAlta = texto(form, "fecha_primera_alta");
  const sugerido = primeraAlta && esFecha(primeraAlta) ? regimenPorPrimeraAlta(primeraAlta) : null;
  // "Por definir" con primera alta capturada = usar el sugerido.
  const capturado = texto(form, "regimen");
  const elegido = (capturado && capturado !== "por_definir" ? capturado : sugerido ?? "por_definir") as "L73" | "L97" | "por_definir";
  const justificacion = texto(form, "regimen_justificacion");
  if (sugerido && elegido !== sugerido && !justificacion) errores.regimen = `Por la primera alta corresponde ${sugerido}; explica por qué lo cambias`;
  if (Object.keys(errores).length) return { errores };

  const totales = n.semanas_cotizadas === null ? null : n.semanas_cotizadas - (n.semanas_descontadas ?? 0) + (n.semanas_reintegradas ?? 0);
  const data = {
    regimen: elegido,
    regimen_justificacion: elegido !== sugerido ? justificacion : null,
    fecha_primera_alta: primeraAlta ? fecha(primeraAlta) : null,
    fecha_constancia: texto(form, "fecha_constancia") ? fecha(texto(form, "fecha_constancia")!) : null,
    fecha_baja: texto(form, "fecha_baja") ? fecha(texto(form, "fecha_baja")!) : null,
    semanas_cotizadas: n.semanas_cotizadas,
    semanas_descontadas: n.semanas_descontadas,
    semanas_reintegradas: n.semanas_reintegradas,
    semanas_totales: totales,
    bimestres_cotizados: n.bimestres_cotizados === null ? null : Math.trunc(n.bimestres_cotizados),
    sbc_ultimo: n.sbc_ultimo,
    sbc_promedio_250: n.sbc_promedio_250,
    ultimo_patron: texto(form, "ultimo_patron"),
    cotiza_actualmente: marcado(form, "cotiza_actualmente"),
  };
  await conUsuario(claims, (tx) => tx.datosImss.upsert({ where: { caso_id: casoId }, update: data, create: { caso_id: casoId, ...data }, select: { id: true } }), ip);
  revalidatePath(`/casos/${casoId}`);
  return { ok: true };
}

export async function guardarAfore(casoId: string, _p: Resultado, form: FormData): Promise<Resultado> {
  const { claims, ip, usuario } = await obtenerSesion();
  const errores: Record<string, string> = {};
  for (const f of ["fecha_apertura_cuenta", "fecha_estado_cuenta", "fecha_ultimo_retiro"]) if (!esFecha(texto(form, f))) errores[f] = "Fecha no válida";
  const saldos: Record<string, number | null> = {};
  for (const k of ["saldo_rcv", "saldo_sar92", "saldo_vivienda", "saldo_voluntarias"]) {
    saldos[k] = decimal(texto(form, k));
    if (saldos[k] !== null && (!Number.isFinite(saldos[k]) || saldos[k]! < 0)) errores[k] = "Monto no válido";
  }
  const estado = (texto(form, "estado_ultimo_retiro") ?? "por_verificar") as "por_verificar" | "nunca_retiro" | "con_retiro";
  const ultimo = texto(form, "fecha_ultimo_retiro");
  if (estado === "con_retiro" && !ultimo) errores.fecha_ultimo_retiro = "Escribe la fecha del último retiro";
  const clabe = texto(form, "clabe")?.replace(/\D/g, "") ?? null;
  if (clabe && clabe.length !== 18) errores.clabe = "La CLABE tiene 18 dígitos";
  if (clabe && usuario.rol === "vendedor") errores.clabe = "Tu rol no captura la CLABE";
  if (Object.keys(errores).length) return { errores };

  const ideVigente = marcado(form, "ide_vigente");
  const data: Prisma.DatosAforeUncheckedUpdateInput = {
    afore: texto(form, "afore"),
    tipo_cuenta: (texto(form, "tipo_cuenta") as "registrada" | "asignada" | null) ?? null,
    fecha_apertura_cuenta: texto(form, "fecha_apertura_cuenta") ? fecha(texto(form, "fecha_apertura_cuenta")!) : null,
    fecha_estado_cuenta: texto(form, "fecha_estado_cuenta") ? fecha(texto(form, "fecha_estado_cuenta")!) : null,
    saldo_rcv: saldos.saldo_rcv,
    saldo_sar92: saldos.saldo_sar92,
    saldo_vivienda: saldos.saldo_vivienda,
    saldo_voluntarias: saldos.saldo_voluntarias,
    estado_ultimo_retiro: estado,
    fecha_ultimo_retiro: estado === "con_retiro" && ultimo ? fecha(ultimo) : null,
    ide_vigente: ideVigente,
    banco: texto(form, "banco"),
    cuenta_nivel4: marcado(form, "cuenta_nivel4"),
    cuenta_solo_digital: marcado(form, "cuenta_solo_digital"),
  };
  if (clabe) Object.assign(data, { clabe_cifrada: cifrar(clabe), clabe_ultimos4: clabe.slice(-4) });

  await conUsuario(claims, async (tx) => {
    const previo = await tx.datosAfore.findUnique({ where: { caso_id: casoId }, select: { ide_vigente: true } });
    if (ideVigente && !previo?.ide_vigente) data.ide_verificado_at = new Date();
    await tx.datosAfore.upsert({
      where: { caso_id: casoId },
      update: data,
      create: { ...(data as Prisma.DatosAforeUncheckedCreateInput), caso_id: casoId },
      select: { id: true },
    });
  }, ip);
  revalidatePath(`/casos/${casoId}`);
  return { ok: true };
}

// Dictamen manual (decisión 27-oct): solo asesor y Director; el trigger lo vuelve a validar.
export async function guardarDictamen(casoId: string, _p: Resultado, form: FormData): Promise<Resultado> {
  const { claims, ip, usuario } = await obtenerSesion();
  if (usuario.rol !== "director" && usuario.rol !== "asesor") return { error: "Solo un asesor o el Director pueden dictaminar." };
  const dictamen = texto(form, "dictamen_manual") as "APTO" | "NO_APTO" | null;
  const motivo = texto(form, "dictamen_manual_motivo");
  if (dictamen && (!motivo || motivo.length < 10)) return { errores: { dictamen_manual_motivo: "Explica el motivo (mínimo 10 caracteres)" } };
  await conUsuario(claims, async (tx) => {
    await tx.caso.update({ where: { id: casoId }, data: { dictamen_manual: dictamen, dictamen_manual_motivo: dictamen ? motivo : null }, select: { id: true } });
    await tx.evento.create({
      data: { caso_id: casoId, tipo: "sistema", usuario_id: usuario.id,
        texto: dictamen ? `Dictamen manual: ${dictamen === "APTO" ? "Apto" : "No apto"} — ${motivo}` : "Se quitó el dictamen manual" },
    });
  }, ip);
  revalidatePath(`/casos/${casoId}`);
  return { ok: true };
}

// ───────────── Cambio de etapa (sección 6) ─────────────

const MOTIVOS_PERDIDA = ["no_elegible", "no_conviene", "precio", "no_contesta", "lo_hizo_solo", "otro"] as const;

export async function cambiarEtapa(casoId: string, _p: Resultado, form: FormData): Promise<Resultado> {
  const { claims, ip, usuario } = await obtenerSesion();
  const destino = texto(form, "destino") as Etapa | null;
  if (!destino || !(destino in NOMBRE_ETAPA)) return { error: "Elige la etapa." };
  const motivo = texto(form, "motivo");
  const hoy = hoyCDMX();
  const p = await parametrosFechas(hoy);

  for (const f of ["fecha_contrato", "fecha_ingreso_solicitud", "fecha_resolucion"]) {
    if (!esFecha(texto(form, f))) return { errores: { [f]: "Fecha no válida" } };
  }

  return conUsuario(claims, async (tx): Promise<Resultado> => {
    const r = await fotoDelCaso(tx, casoId, hoy, p);
    if (!r) return { error: "No encontramos el caso." };
    const { caso, foto } = r;

    // Lo que se captura junto con el cambio (fecha de firma, acuse, resolución…).
    const cambios: Prisma.CasoUncheckedUpdateInput = {};
    const fc = texto(form, "fecha_contrato");
    if (fc) { cambios.fecha_contrato = fecha(fc); foto.fechaContrato = fc; }
    if (form.has("analisis_impacto_ok")) {
      cambios.analisis_impacto_ok = foto.analisisImpactoOk = marcado(form, "analisis_impacto_ok");
      cambios.cliente_entendio_costo = foto.clienteEntendioCosto = marcado(form, "cliente_entendio_costo");
      cambios.analisis_impacto_texto = texto(form, "analisis_impacto_texto");
    }
    const honorario = decimal(texto(form, "honorario_fijo"));
    if (honorario !== null && Number.isFinite(honorario) && honorario > 0) { cambios.honorario_fijo = honorario; foto.honorarioFijo = true; }
    const ingreso = texto(form, "fecha_ingreso_solicitud");
    if (ingreso) { cambios.fecha_ingreso_solicitud = fecha(ingreso); foto.fechaIngresoSolicitud = ingreso; }
    const acuse = texto(form, "acuse_afore");
    if (acuse) { cambios.acuse_afore = acuse; foto.acuseAfore = acuse; }
    const resultadoAfore = texto(form, "resultado_afore") as FotoCasoResultado;
    if (resultadoAfore) { cambios.resultado_afore = resultadoAfore; foto.resultadoAfore = resultadoAfore; }
    const resolucion = texto(form, "fecha_resolucion");
    if (resolucion) { cambios.fecha_resolucion = fecha(resolucion); foto.fechaResolucion = resolucion; }

    const faltantes = validarTransicion(foto, destino, usuario.rol, motivo);
    if (faltantes.length) return { faltantes };

    // Al firmar, el caso pasa solo a "Armando expediente" (6.1, etapa 4).
    const final: Etapa = destino === "CONTRATO" && foto.embudo === "retiro" ? "EXPEDIENTE" : destino;
    cambios.etapa = final;
    cambios.etapa_desde = new Date();
    let diasSuspendidos = caso.dias_suspendidos;

    if (destino === "CONTRATO") {
      cambios.fecha_vencimiento_contrato = fecha(vencimientoContrato(foto.fechaContrato!, diasSuspendidos, p));
    }
    if (destino === "INGRESADA") {
      cambios.fecha_limite_resolucion = fecha(sumarDiasHabiles(foto.fechaIngresoSolicitud!, p.AFORE_DIAS_HABILES, p.inhabiles));
    }
    if (destino === "PERDIDO") {
      const mp = texto(form, "motivo_perdida");
      cambios.motivo_perdida = (MOTIVOS_PERDIDA as readonly string[]).includes(mp ?? "") ? (mp as (typeof MOTIVOS_PERDIDA)[number]) : "otro";
      cambios.motivo_perdida_texto = motivo;
    }
    if (destino === "BLOQUEADO") {
      cambios.motivo_bloqueo = motivo;
      // Bloqueo atribuible al cliente: se suspende la vigencia del contrato (6.3).
      if (marcado(form, "atribuible_cliente")) {
        await tx.suspensionContrato.create({ data: { caso_id: casoId, inicio: fecha(hoy), motivo: motivo! } });
      }
    }
    if (foto.etapa === "BLOQUEADO") {
      const abiertas = await tx.suspensionContrato.findMany({ where: { caso_id: casoId, fin: null, archivado_at: null } });
      for (const s of abiertas) {
        await tx.suspensionContrato.update({ where: { id: s.id }, data: { fin: fecha(hoy) } });
        diasSuspendidos += Math.max(0, diasEntre(s.inicio.toISOString().slice(0, 10), hoy));
      }
      if (abiertas.length) {
        cambios.dias_suspendidos = diasSuspendidos;
        if (foto.fechaContrato) cambios.fecha_vencimiento_contrato = fecha(vencimientoContrato(foto.fechaContrato, diasSuspendidos, p));
      }
    }

    await tx.caso.update({ where: { id: casoId }, data: cambios, select: { id: true } });
    const pasos: [Etapa, Etapa][] = final === destino ? [[foto.etapa, destino]] : [[foto.etapa, destino], [destino, final]];
    for (const [antes, despues] of pasos) {
      await tx.historialEtapa.create({ data: { caso_id: casoId, etapa_antes: antes, etapa_nueva: despues, motivo, usuario_id: usuario.id } });
    }
    await tx.evento.create({
      data: {
        caso_id: casoId, tipo: "cambio_etapa", usuario_id: usuario.id,
        texto: `${NOMBRE_ETAPA[foto.etapa]} → ${NOMBRE_ETAPA[final]}${final !== destino ? " (contrato firmado)" : ""}${motivo ? `: ${motivo}` : ""}`,
      },
    });
    return { ok: true };
  }, ip).then((res) => {
    if (res.ok) revalidatePath(`/casos/${casoId}`);
    return res;
  });
}

type FotoCasoResultado = "aprobado" | "rechazado" | "requiere_cita" | null;
