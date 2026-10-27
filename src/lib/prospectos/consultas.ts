// Lecturas de prospectos y casos. Todas pasan por conUsuario(): RLS decide qué ve cada rol.
import "server-only";
import type { Etapa, Prisma } from "@/generated/prisma/client";
import type { Sesion } from "@/lib/auth/sesion";
import { hashIdentificador } from "@/lib/cripto";
import { conUsuario } from "@/lib/db/prisma";
import { tipoIdentificador } from "@/lib/reglas/identificadores";

// Etapas en las que un caso todavía se trabaja como prospecto (10.2).
export const ETAPAS_PROSPECTO: Etapa[] = ["PROSPECTO", "PRECALIFICADO", "EN_ESPERA", "DIAGNOSTICO", "PLAN_ENTREGADO"];

const sinAcentos = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

type Busqueda = { where: Prisma.CasoWhereInput } | { palabras: string[] } | null;

/** Traduce lo que alguien escribe en el buscador a un filtro de casos. */
export function filtroBusqueda(q: string): Busqueda {
  const texto = q.trim();
  if (!texto) return null;

  const tipo = tipoIdentificador(texto);
  if (tipo) {
    const hash = hashIdentificador(tipo, texto);
    return { where: { persona: tipo === "curp" ? { curp_hash: hash } : { nss_hash: hash } } };
  }

  const folio = texto.match(/^[a-z]{2}-?(\d{1,6})$/i);
  if (folio) return { where: { folio: { endsWith: folio[1].padStart(4, "0") } } };

  const digitos = texto.replace(/\D/g, "");
  if (digitos.length >= 4 && /^[\d\s()+-]+$/.test(texto)) {
    return { where: { persona: { OR: [{ whatsapp: { contains: digitos } }, { telefono: { contains: digitos } }] } } };
  }

  // Texto libre: cada palabra debe aparecer en el nombre completo, sin importar acentos.
  return { palabras: sinAcentos(texto).split(/\s+/).filter(Boolean).slice(0, 6) };
}

// Postgres sin la extensión unaccent: translate() quita los acentos del español.
const CON_ACENTO = "áéíóúüñàèìòù";
const SIN_ACENTO = "aeiouunaeiou";

const seleccionLista = {
  id: true,
  folio: true,
  etapa: true,
  created_at: true,
  persona: { select: { nombre: true, apellido_paterno: true, apellido_materno: true, whatsapp: true, origen: true } },
  servicio: { select: { clave: true, nombre: true } },
  datos_imss: { select: { fecha_baja: true } },
  eventos: { select: { fecha: true }, orderBy: { fecha: "desc" as const }, take: 1 },
} satisfies Prisma.CasoSelect;

export type FilaProspecto = Prisma.CasoGetPayload<{ select: typeof seleccionLista }>;

export async function listarProspectos({ claims, ip }: Sesion, q = ""): Promise<FilaProspecto[]> {
  const filtro = filtroBusqueda(q);
  return conUsuario(
    claims,
    async (tx) => {
      let where: Prisma.CasoWhereInput = { archivado_at: null, etapa: { in: ETAPAS_PROSPECTO } };
      if (filtro && "where" in filtro) where = { archivado_at: null, ...filtro.where };
      if (filtro && "palabras" in filtro) {
        // RLS también aplica a esta consulta: solo regresa personas que el usuario puede ver.
        const patrones = filtro.palabras.map((p) => `%${p.replace(/[\\%_]/g, "\\$&")}%`);
        const filas = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM personas
          WHERE translate(lower(concat_ws(' ', nombre, apellido_paterno, apellido_materno)), ${CON_ACENTO}, ${SIN_ACENTO})
                LIKE ALL (${patrones}::text[])`;
        where = { archivado_at: null, persona_id: { in: filas.map((f) => f.id) } };
      }
      return tx.caso.findMany({ where, select: seleccionLista, orderBy: { created_at: "desc" }, take: 200 });
    },
    ip,
  );
}

export async function contarProspectosActivos({ claims, ip }: Sesion): Promise<number> {
  return conUsuario(claims, (tx) => tx.caso.count({ where: { archivado_at: null, etapa: { in: ETAPAS_PROSPECTO } } }), ip);
}

export async function listarCasos({ claims, ip }: Sesion) {
  return conUsuario(
    claims,
    (tx) => tx.caso.findMany({ where: { archivado_at: null }, select: { ...seleccionLista, etapa_desde: true }, orderBy: { etapa_desde: "asc" } }),
    ip,
  );
}

export async function obtenerCaso({ claims, ip }: Sesion, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return conUsuario(
    claims,
    (tx) =>
      tx.caso.findUnique({
        where: { id },
        include: {
          persona: true,
          servicio: { select: { clave: true, nombre: true, embudo: true } },
          asignado: { select: { nombre: true } },
          vendedor: { select: { nombre: true } },
          referidor: { select: { nombre: true } },
          datos_imss: true,
          datos_afore: true,
          eventos: { orderBy: { fecha: "desc" }, take: 50, include: { usuario: { select: { nombre: true } } } },
        },
      }),
    ip,
  );
}

export type CasoDetalle = NonNullable<Awaited<ReturnType<typeof obtenerCaso>>>;

export async function opcionesAlta({ claims, ip }: Sesion) {
  return conUsuario(
    claims,
    async (tx) => ({
      servicios: await tx.tipoServicio.findMany({ where: { activo: true }, select: { clave: true, nombre: true }, orderBy: { orden: "asc" } }),
      referidores: await tx.referidor.findMany({ where: { archivado_at: null }, select: { id: true, nombre: true }, orderBy: { nombre: "asc" } }),
    }),
    ip,
  );
}

export const nombreCompleto = (p: { nombre: string; apellido_paterno: string | null; apellido_materno: string | null }) =>
  [p.nombre, p.apellido_paterno, p.apellido_materno].filter(Boolean).join(" ");
