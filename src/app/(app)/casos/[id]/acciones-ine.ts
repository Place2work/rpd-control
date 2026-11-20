"use server";

// Lectura de la INE (20-nov-2026): al subir la identificación, la IA lee nombre, CURP y domicilio. Los datos vacíos
// del cliente se llenan solos; los que ya tienen otro valor se muestran lado a lado para que el usuario elija.
// La CURP se guarda cifrada (con su hash y la parcial); en pantalla solo se ve la parcial. Todo con RLS.
import { revalidatePath } from "next/cache";
import { obtenerSesion } from "@/lib/auth/sesion";
import { cifrar, hashIdentificador } from "@/lib/cripto";
import { conUsuario } from "@/lib/db/prisma";
import { leerIneGuardada } from "@/lib/ine/leer";
import { componerDomicilio } from "@/lib/reglas/domicilio";
import type { LecturaIne } from "@/lib/reglas/ine";
import { curpParcial, datosDeCurp, validarCurp } from "@/lib/reglas/identificadores";
import { hoyCDMX } from "@/lib/tiempo";

export type CampoIne = { clave: ClaveIne; etiqueta: string; ine: string; caso: string; cambia: boolean };
export type VistaIne = {
  error?: string;
  avisos?: string[];
  curpDistinta?: boolean;
  llenados?: string[];
  campos?: CampoIne[];
  /** Valores leídos (con la CURP completa) para mandarlos de vuelta al confirmar: no se muestran tal cual. */
  valores?: Partial<Record<ClaveIne, string>>;
};

type ClaveIne = "nombre" | "apellido_paterno" | "apellido_materno" | "curp" | "fecha_nacimiento" | "sexo" | "calle" | "numero_exterior"
  | "numero_interior" | "colonia" | "codigo_postal" | "municipio" | "estado" | "identificacion";

const ETIQUETAS: Record<ClaveIne, string> = {
  nombre: "Nombre(s)", apellido_paterno: "Apellido paterno", apellido_materno: "Apellido materno", curp: "CURP",
  fecha_nacimiento: "Fecha de nacimiento", sexo: "Sexo", calle: "Calle", numero_exterior: "Número exterior", numero_interior: "Número interior",
  colonia: "Colonia", codigo_postal: "Código postal", municipio: "Municipio o alcaldía", estado: "Estado", identificacion: "Identificación",
};
const CLAVES = Object.keys(ETIQUETAS) as ClaveIne[];
const enTexto = (k: ClaveIne) => (k === "curp" ? "CURP" : ETIQUETAS[k].toLowerCase());
const DOMICILIO: ClaveIne[] = ["calle", "numero_exterior", "numero_interior", "colonia", "codigo_postal", "municipio", "estado"];

const dia = (v: string) => new Date(`${v}T00:00:00Z`);
const isoDe = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
const corta = (v: string) => v.split("-").reverse().join("/");
/** Para comparar sin que cuenten mayúsculas, acentos ni espacios dobles. */
const igual = (a: string, b: string) => {
  const n = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").replace(/\s+/g, " ").trim().toLowerCase();
  return n(a) === n(b);
};

type PersonaIne = {
  id: string; nombre: string; apellido_paterno: string | null; apellido_materno: string | null; curp_hash: string | null; curp_parcial: string | null;
  fecha_nacimiento: Date | null; sexo: string | null; calle: string | null; numero_exterior: string | null; numero_interior: string | null;
  colonia: string | null; codigo_postal: string | null; municipio: string | null; estado: string | null; domicilio: string | null; identificacion: string | null;
};
const SELECT_PERSONA = {
  id: true, nombre: true, apellido_paterno: true, apellido_materno: true, curp_hash: true, curp_parcial: true, fecha_nacimiento: true, sexo: true,
  calle: true, numero_exterior: true, numero_interior: true, colonia: true, codigo_postal: true, municipio: true, estado: true, domicilio: true, identificacion: true,
} as const;

function valoresDe(l: LecturaIne): Partial<Record<ClaveIne, string>> {
  const v: Partial<Record<ClaveIne, string | null>> = {
    nombre: l.nombre, apellido_paterno: l.apellidoPaterno, apellido_materno: l.apellidoMaterno, curp: l.curp, fecha_nacimiento: l.fechaNacimiento,
    sexo: l.sexo, calle: l.calle, numero_exterior: l.numeroExterior, numero_interior: l.numeroInterior, colonia: l.colonia, codigo_postal: l.codigoPostal,
    municipio: l.municipio, estado: l.estado,
    identificacion: l.vigencia && l.vigente ? `Credencial para votar (INE) vigente hasta ${l.vigencia}` : null,
  };
  return Object.fromEntries(Object.entries(v).filter(([, x]) => x)) as Partial<Record<ClaveIne, string>>;
}

/** Lo que ya tiene el cliente, como texto ("" si está vacío). La CURP se compara por hash. */
function actual(p: PersonaIne, k: ClaveIne): string {
  if (k === "curp") return p.curp_hash ? (p.curp_parcial ?? "Capturada") : "";
  if (k === "fecha_nacimiento") return isoDe(p.fecha_nacimiento) ?? "";
  return (p[k] ?? "").trim();
}
const mostrar = (k: ClaveIne, v: string) => (!v ? "—" : k === "fecha_nacimiento" ? corta(v) : k === "sexo" ? (v === "H" ? "Hombre" : v === "M" ? "Mujer" : v) : v);

function comparar(p: PersonaIne, valores: Partial<Record<ClaveIne, string>>) {
  const curpLeida = valores.curp ?? null;
  const curpDistinta = Boolean(curpLeida && p.curp_hash && hashIdentificador("curp", curpLeida) !== p.curp_hash);
  const campos: CampoIne[] = [];
  for (const k of CLAVES) {
    const leido = valores[k];
    if (!leido) continue;
    const ya = actual(p, k);
    const cambia = k === "curp" ? !p.curp_hash || curpDistinta : !igual(leido, ya);
    campos.push({ clave: k, etiqueta: ETIQUETAS[k], ine: k === "curp" ? curpParcial(leido) : mostrar(k, leido), caso: mostrar(k, ya), cambia });
  }
  return { curpDistinta, campos };
}

/** Revisa en el servidor lo que regresa del navegador (son los valores leídos, pero no se confía en ellos). */
function limpiar(valores: Partial<Record<ClaveIne, string>>): { ok?: Partial<Record<ClaveIne, string>>; error?: string } {
  const r: Partial<Record<ClaveIne, string>> = {};
  for (const k of CLAVES) {
    const v = (valores[k] ?? "").replace(/\s+/g, " ").trim();
    if (!v) continue;
    if (v.length > 160) return { error: `${ETIQUETAS[k]} es demasiado largo.` };
    if (k === "curp") { const c = validarCurp(v); if (!c.valido) return { error: "La CURP no es válida." }; r.curp = c.valor; continue; }
    if (k === "fecha_nacimiento" && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return { error: "La fecha de nacimiento no es válida." };
    if (k === "sexo" && !/^[HM]$/.test(v)) return { error: "El sexo no es válido." };
    if (k === "codigo_postal" && !/^\d{5}$/.test(v)) return { error: "El código postal no es válido." };
    r[k] = v;
  }
  return { ok: r };
}

async function persona(casoId: string, documentoId: string) {
  const { claims, ip, usuario } = await obtenerSesion();
  if (usuario.rol === "vendedor") return { error: "Tu rol no ve los documentos del expediente." };
  const datos = await conUsuario(claims, async (tx) => {
    const doc = await tx.documento.findFirst({ where: { id: documentoId, caso_id: casoId, archivado_at: null }, select: { archivo_path: true, archivo_mime: true } });
    const caso = await tx.caso.findUnique({ where: { id: casoId }, select: { persona: { select: SELECT_PERSONA } } });
    return { doc, persona: caso?.persona ?? null };
  }, ip);
  if (!datos.doc?.archivo_path || !datos.persona) return { error: "No encontramos el documento." };
  return { claims, ip, usuario, doc: { ruta: datos.doc.archivo_path, mime: datos.doc.archivo_mime ?? "" }, persona: datos.persona as PersonaIne };
}

/** Escribe los campos elegidos en la persona (y el domicilio del contrato) y deja el evento en Seguimiento. */
type Ctx = Exclude<Awaited<ReturnType<typeof persona>>, { error: string }>;
async function guardar(ctx: Ctx, casoId: string, documentoId: string, valores: Partial<Record<ClaveIne, string>>, elegidos: ClaveIne[],
  modo: "ine_leida" | "ine_auto", nota?: string): Promise<{ ok?: boolean; error?: string }> {
  const p = ctx.persona;
  const data: Record<string, unknown> = {};
  for (const k of elegidos) {
    const v = valores[k];
    if (!v) continue;
    if (k === "curp") {
      if (p.curp_hash) continue; // una CURP ya capturada no se reemplaza desde aquí: se corrige en Datos del cliente con bitácora
      const deCurp = datosDeCurp(v);
      Object.assign(data, { curp_cifrada: cifrar(v), curp_hash: hashIdentificador("curp", v), curp_parcial: curpParcial(v),
        fecha_nacimiento: dia(deCurp.fechaNacimiento), ...(deCurp.sexo !== "X" ? { sexo: deCurp.sexo } : {}) });
    } else if (k === "fecha_nacimiento") data.fecha_nacimiento = dia(v);
    else data[k] = v;
  }
  // Domicilio del contrato: se recompone si estaba vacío o si era el que salía de las partes anteriores.
  if (DOMICILIO.some((k) => k in data)) {
    const antes = componerDomicilio({ calle: p.calle, numeroExterior: p.numero_exterior, numeroInterior: p.numero_interior, colonia: p.colonia,
      codigoPostal: p.codigo_postal, municipio: p.municipio, estado: p.estado });
    const parte = (k: ClaveIne) => (k in data ? (data[k] as string) : p[k as keyof PersonaIne] as string | null);
    if (!p.domicilio || p.domicilio === antes) {
      data.domicilio = componerDomicilio({ calle: parte("calle"), numeroExterior: parte("numero_exterior"), numeroInterior: parte("numero_interior"),
        colonia: parte("colonia"), codigoPostal: parte("codigo_postal"), municipio: parte("municipio"), estado: parte("estado") });
    }
  }
  const nombres = elegidos.filter((k) => valores[k] && (k !== "curp" || !p.curp_hash)).map(enTexto);
  try {
    await conUsuario(ctx.claims, async (tx) => {
      if (Object.keys(data).length) await tx.persona.update({ where: { id: p.id }, data, select: { id: true } });
      await tx.evento.create({ data: { caso_id: casoId, tipo: "documento", usuario_id: ctx.usuario.id,
        datos: { campo: modo, documento_id: documentoId, campos: nombres },
        texto: nota ?? (nombres.length
          ? `Se leyó la INE y se ${modo === "ine_auto" ? "llenaron los datos vacíos" : "pasaron los datos elegidos"}: ${nombres.join(", ")}.`
          : "Se leyó la INE; no había datos vacíos que llenar.") } });
    }, ctx.ip);
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") {
      if (modo === "ine_auto") await conUsuario(ctx.claims, (tx) => tx.evento.create({ data: { caso_id: casoId, tipo: "documento", usuario_id: ctx.usuario.id,
        datos: { campo: modo, documento_id: documentoId, campos: [] },
        texto: "Se leyó la INE, pero su CURP ya pertenece a otra persona registrada: no se llenó nada." } }), ctx.ip).catch(() => null);
      return { error: "Esa CURP ya pertenece a otra persona registrada. Revisa que sea la INE de este cliente." };
    }
    console.error("[ine] guardar", (e as Error).message);
    return { error: "No se pudo guardar." };
  }
  revalidatePath(`/casos/${casoId}`);
  return { ok: true };
}

async function leer(casoId: string, documentoId: string) {
  const ctx = await persona(casoId, documentoId);
  if ("error" in ctx) return { error: ctx.error };
  const r = await leerIneGuardada(ctx.doc.ruta, ctx.doc.mime, hoyCDMX());
  if (!r.lectura) return { error: r.error };
  return { ctx, lectura: r.lectura, valores: valoresDe(r.lectura) };
}

/** Botón «Leer INE»: lee y compara, sin guardar nada. */
export async function verIne(casoId: string, documentoId: string): Promise<VistaIne> {
  const r = await leer(casoId, documentoId);
  if (!r.ctx) return { error: r.error };
  const { curpDistinta, campos } = comparar(r.ctx.persona, r.valores);
  return { avisos: r.lectura.avisos, curpDistinta, campos, valores: r.valores };
}

/** Al subir la INE: llena solo lo vacío y regresa lo que difiere para que el usuario decida. */
export async function autoIne(casoId: string, documentoId: string): Promise<VistaIne> {
  const r = await leer(casoId, documentoId);
  if (!r.ctx) return { error: r.error };
  const { curpDistinta, campos } = comparar(r.ctx.persona, r.valores);
  if (curpDistinta) {
    await guardar(r.ctx, casoId, documentoId, r.valores, [], "ine_auto", "Se leyó la INE, pero su CURP no es la del cliente: no se llenó nada.");
    return { avisos: r.lectura.avisos, curpDistinta, campos, valores: r.valores, llenados: [] };
  }
  const vacios = campos.filter((c) => c.caso === "—").map((c) => c.clave);
  const g = await guardar(r.ctx, casoId, documentoId, r.valores, vacios, "ine_auto");
  if (g.error) return { error: g.error, avisos: r.lectura.avisos, curpDistinta, campos, valores: r.valores };
  return { avisos: r.lectura.avisos, curpDistinta, llenados: vacios.map(enTexto),
    campos: campos.filter((c) => c.cambia && c.caso !== "—"), valores: r.valores };
}

/** Pasa los datos que el usuario eligió en la comparación. */
export async function aplicarIne(casoId: string, documentoId: string, valores: Partial<Record<ClaveIne, string>>, elegidos: string[]): Promise<{ ok?: boolean; error?: string }> {
  const ctx = await persona(casoId, documentoId);
  if ("error" in ctx) return { error: ctx.error };
  const limpio = limpiar(valores);
  if (!limpio.ok) return { error: limpio.error };
  if (limpio.ok.curp && ctx.persona.curp_hash && hashIdentificador("curp", limpio.ok.curp) !== ctx.persona.curp_hash) {
    return { error: "La CURP de la INE no es la de este cliente. Revisa que sea el documento correcto." };
  }
  const claves = elegidos.filter((k): k is ClaveIne => (CLAVES as string[]).includes(k));
  if (!claves.length) return { error: "Marca al menos un dato para pasar." };
  return guardar(ctx, casoId, documentoId, limpio.ok, claves, "ine_leida");
}
