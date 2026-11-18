// Equipo en vivo: quién está en cada departamento y lo que hizo hoy (hora de la Ciudad de México). Con la sesión de
// quien consulta (el Director), así que respeta RLS. No sale ningún dato del cliente.
import "server-only";
import type { Tx } from "@/lib/db/prisma";
import { NOMBRE_ETAPA, type Etapa } from "@/lib/reglas/etapas";
import { hoyCDMX, inicioDiaCDMX } from "@/lib/tiempo";
import { DEPARTAMENTO_DE_ROL, type Actividad, type Departamento } from "./actividad";

export type Persona = { id: string; nombre: string; departamento: Departamento; conCuenta: boolean };
export type FotoEquipo = { personas: Persona[]; actividades: Actividad[]; hora: string };

export async function fotoEquipo(tx: Tx): Promise<FotoEquipo> {
  const desde = inicioDiaCDMX(hoyCDMX());
  const [usuarios, fichasSinCuenta, casos, campo, verificados, etapas, jornadas] = await Promise.all([
    tx.usuario.findMany({ where: { activo: true, archivado_at: null }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true, rol: true } }),
    tx.socio.findMany({ where: { archivado_at: null, usuarios: { none: { activo: true } } }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }),
    tx.caso.findMany({ where: { created_at: { gte: desde } }, select: { id: true, owner_id: true, created_at: true } }),
    tx.campoProspecto.findMany({ where: { created_at: { gte: desde }, gerente_id: { not: null }, archivado_at: null }, select: { id: true, gerente_id: true, created_at: true, municipio: true } }),
    tx.campoProspecto.findMany({ where: { verificado_at: { gte: desde }, estado: "verificado", verificado_por: { not: null } }, select: { id: true, verificado_por: true, verificado_at: true } }),
    tx.historialEtapa.findMany({ where: { fecha: { gte: desde }, usuario_id: { not: null }, etapa_antes: { not: null } }, select: { id: true, usuario_id: true, fecha: true, etapa_nueva: true } }),
    tx.campoJornada.findMany({ where: { created_at: { gte: desde } }, select: { id: true, gerente_id: true, created_at: true, municipio: true } }),
  ]);
  const personas: Persona[] = [
    ...usuarios.filter((u) => DEPARTAMENTO_DE_ROL[u.rol]).map((u) => ({ id: u.id, nombre: u.nombre, departamento: DEPARTAMENTO_DE_ROL[u.rol], conCuenta: true })),
    ...fichasSinCuenta.map((s) => ({ id: `ficha:${s.id}`, nombre: s.nombre, departamento: "asesores" as const, conCuenta: false })),
  ];
  const actividades: Actividad[] = [
    ...casos.map((c) => ({ id: `c:${c.id}`, tipo: "prospecto" as const, usuarioId: c.owner_id, at: c.created_at.toISOString() })),
    ...campo.map((p) => ({ id: `p:${p.id}`, tipo: "campo" as const, usuarioId: p.gerente_id!, at: p.created_at.toISOString(), detalle: p.municipio })),
    ...verificados.map((p) => ({ id: `v:${p.id}`, tipo: "verificacion" as const, usuarioId: p.verificado_por!, at: p.verificado_at!.toISOString() })),
    ...etapas.map((h) => ({ id: `e:${h.id}`, tipo: h.etapa_nueva === "CERRADO" ? "cierre" as const : "etapa" as const, usuarioId: h.usuario_id!, at: h.fecha.toISOString(),
      detalle: NOMBRE_ETAPA[h.etapa_nueva as Etapa] ?? null })),
    ...jornadas.map((j) => ({ id: `j:${j.id}`, tipo: "jornada" as const, usuarioId: j.gerente_id, at: j.created_at.toISOString(), detalle: j.municipio })),
  ].sort((a, b) => (a.at < b.at ? 1 : -1));
  return { personas, actividades, hora: new Date().toISOString() };
}
