import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Encabezado } from "@/components/rpd/encabezado";
import { InsigniaAfore } from "@/components/rpd/insignia-afore";
import { exigirRol } from "@/lib/auth/sesion";
import { comisionesProyectadas } from "@/lib/comisiones/proyectadas";
import { conUsuario } from "@/lib/db/prisma";
import { mxn } from "@/lib/formato";
import { NOMBRE_PARENTESCO } from "@/lib/prospectos/referencias";
import { NOMBRE_ETAPA } from "@/lib/reglas/etapas";
import { CampoTexto, Seleccion } from "../casos/[id]/campos";
import { FormularioAccion } from "../casos/[id]/formulario-accion";
import { editarProspecto } from "./acciones";
import { Desplegable } from "./desplegable";

export const metadata: Metadata = { title: "Asesores y referidores" };

const ETIQUETAS = { nombre: "Nombre(s)", apellido_paterno: "Apellido paterno", apellido_materno: "Apellido materno", whatsapp: "WhatsApp", socio_id: "Asesor de pensiones", referidor_id: "Referidor" };
const PROSPECTO = new Set(["PROSPECTO", "PRECALIFICADO", "DIAGNOSTICO"]);
const local = (wa: string | null) => (wa ? wa.replace(/^\+?52/, "") : "");

type CasoPanel = {
  id: string; folio: string; etapa: string; servicio: string; afore: string | null; esperado: number | null;
  socio_id: string | null; referidor_id: string | null;
  persona: { nombre: string; apellido_paterno: string | null; apellido_materno: string | null; whatsapp: string | null;
    referencias: { orden: number; nombre: string; telefono: string | null; parentesco: string | null; confirmada_at: Date | null }[] };
};

export default async function Asesores({ searchParams }: { searchParams: Promise<{ abierto?: string }> }) {
  const { abierto } = await searchParams;
  const sesion = await exigirRol("director", "asesor");
  const [d, proy] = await Promise.all([
    conUsuario(sesion.claims, async (tx) => ({
      socios: await tx.socio.findMany({ where: { archivado_at: null }, orderBy: { nombre: "asc" },
        select: { id: true, nombre: true, porcentaje_socio: true, usuarios: { where: { activo: true }, select: { id: true } } } }),
      referidores: await tx.referidor.findMany({ where: { archivado_at: null }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true, telefono: true } }),
      servicios: await tx.tipoServicio.findMany({ select: { clave: true, nombre: true } }),
      casos: await tx.caso.findMany({ where: { archivado_at: null, etapa: { not: "PERDIDO" } }, orderBy: { created_at: "desc" },
        select: { id: true, folio: true, etapa: true, tipo_servicio: true, socio_id: true, referidor_id: true, monto_afore_esperado: true,
          datos_afore: { select: { afore: true } },
          persona: { select: { nombre: true, apellido_paterno: true, apellido_materno: true, whatsapp: true,
            referencias: { where: { archivado_at: null }, orderBy: { orden: "asc" }, select: { orden: true, nombre: true, telefono: true, parentesco: true, confirmada_at: true } } } } } }),
    }), sesion.ip),
    comisionesProyectadas(sesion),
  ]);

  const servicio = new Map(d.servicios.map((s) => [s.clave, s.nombre]));
  const casos: CasoPanel[] = d.casos.map((c) => ({
    id: c.id, folio: c.folio, etapa: c.etapa, servicio: servicio.get(c.tipo_servicio) ?? c.tipo_servicio, afore: c.datos_afore?.afore ?? null,
    esperado: c.monto_afore_esperado === null ? null : Number(c.monto_afore_esperado), socio_id: c.socio_id, referidor_id: c.referidor_id, persona: c.persona,
  }));
  // Comisión por pagar de cada caso, por beneficiario (lo devengado o, si aún no hay, lo proyectado).
  const comision = new Map<string, number>();
  for (const f of proy.filas) comision.set(`${f.clave}|${f.casoId}`, (comision.get(`${f.clave}|${f.casoId}`) ?? 0) + f.monto);
  const totalDe = (clave: string) => proy.porBeneficiario.find((b) => b.clave === clave)?.monto ?? 0;

  const opcionesSocio = d.socios.map((s) => [s.id, s.nombre] as const);
  const opcionesReferidor = d.referidores.map((r) => [r.id, r.nombre] as const);
  const sinAsignar = casos.filter((c) => !c.socio_id && !c.referidor_id && c.etapa !== "CERRADO");

  const grupo = (clave: string, titulo: string, detalle: string, lista: CasoPanel[]) => (
    <Grupo key={clave} clave={clave} abierto={abierto === clave} titulo={titulo} detalle={detalle} casos={lista} comision={comision} total={totalDe(clave)}
      opcionesSocio={opcionesSocio} opcionesReferidor={opcionesReferidor} />
  );

  return (
    <>
      <Encabezado titulo="Asesores y referidores" descripcion="Da clic en un nombre para ver sus prospectos y casos. Desde ahí editas el nombre, el WhatsApp y a quién pertenece cada caso.">
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/comisiones/beneficiarios" className="text-sm text-brand underline">Datos de pago y % de comisión</Link>
          {sesion.usuario.rol === "director" && <Link href="/configuracion?seccion=usuarios" className="text-sm text-brand underline">Agregar asesor (Configuración → Usuarios)</Link>}
        </div>
      </Encabezado>
      <div className="grid gap-6">
        <Card>
          <CardHeader><CardTitle>Asesores de pensiones</CardTitle><span className="text-sm text-ink-muted">{d.socios.length}</span></CardHeader>
          <CardContent className="grid gap-2">
            {d.socios.length === 0 && <p className="text-sm text-ink-muted">Todavía no hay asesores de pensiones.</p>}
            {d.socios.map((s) => grupo(`socio:${s.id}`, s.nombre,
              `${Math.round(Number(s.porcentaje_socio) * 100)}% · ${s.usuarios.length ? "con cuenta" : "sin cuenta"}`, casos.filter((c) => c.socio_id === s.id)))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Referidores</CardTitle><span className="text-sm text-ink-muted">{d.referidores.length}</span></CardHeader>
          <CardContent className="grid gap-2">
            {d.referidores.length === 0 && <p className="text-sm text-ink-muted">Todavía no hay referidores.</p>}
            {d.referidores.map((r) => grupo(`referidor:${r.id}`, r.nombre, r.telefono ?? "Sin teléfono", casos.filter((c) => c.referidor_id === r.id)))}
          </CardContent>
        </Card>
        {sinAsignar.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Sin asesor ni referidor</CardTitle><span className="text-sm text-ink-muted">{sinAsignar.length}</span></CardHeader>
            <CardContent className="grid gap-2">
              <p className="text-sm text-ink-muted">Casos vivos que todavía no tienen a nadie asignado. Dale «Editar» para asignarlos.</p>
              {grupo("sin", "Ver casos sin asignar", "venta directa", sinAsignar)}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}

function Grupo({ clave, abierto, titulo, detalle, casos, comision, total, opcionesSocio, opcionesReferidor }: {
  clave: string; abierto: boolean; titulo: string; detalle: string; casos: CasoPanel[]; comision: Map<string, number>; total: number;
  opcionesSocio: (readonly [string, string])[]; opcionesReferidor: (readonly [string, string])[];
}) {
  const prospectos = casos.filter((c) => PROSPECTO.has(c.etapa)).length;
  const cerrados = casos.filter((c) => c.etapa === "CERRADO").length;
  const tramite = casos.length - prospectos - cerrados;
  return (
    <Desplegable clave={clave} abierto={abierto}>
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-slate-50">
        <ChevronDown className="size-4 shrink-0 text-ink-muted transition-transform group-open:rotate-180" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="font-medium text-ink">{titulo}</span>
          <span className="block text-xs text-ink-muted">{detalle}</span>
        </span>
        <span className="flex flex-wrap gap-2 text-xs">
          <Badge tono="prospecto">{prospectos} {prospectos === 1 ? "prospecto" : "prospectos"}</Badge>
          <Badge tono="tramite">{tramite} en trámite</Badge>
          <Badge tono="pagado">{cerrados} {cerrados === 1 ? "cerrado" : "cerrados"}</Badge>
        </span>
        {clave !== "sin" && <span className="cifra w-full text-right text-sm text-ink sm:w-36">{mxn(total)}<span className="block text-xs text-ink-muted">comisión por pagar</span></span>}
      </summary>
      <div className="border-t border-borde">
        {casos.length === 0 ? (
          <p className="px-4 py-3 text-sm text-ink-muted">Sin prospectos ni casos todavía.</p>
        ) : (
          <ul className="divide-y divide-borde">
            {casos.map((c) => {
              const nombre = [c.persona.nombre, c.persona.apellido_paterno, c.persona.apellido_materno].filter(Boolean).join(" ");
              const monto = clave !== "sin" ? comision.get(`${clave}|${c.id}`) : undefined;
              return (
                <li key={c.id} className="px-4 py-3">
                  <div className="grid gap-2 text-sm md:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_minmax(0,1fr)_8rem_auto] md:items-center">
                    <span className="flex min-w-0 items-center gap-2">
                      {c.afore && <InsigniaAfore clave={c.afore} tamano="sm" sinNombre />}
                      <span className="min-w-0">
                        <Link href={`/casos/${c.id}`} className="font-medium text-brand hover:underline">{nombre}</Link>
                        <span className="block text-xs text-ink-muted">{c.folio} · {c.persona.whatsapp ? local(c.persona.whatsapp) : "sin WhatsApp"}</span>
                      </span>
                    </span>
                    <span className="text-ink-muted">{c.servicio}</span>
                    <span><Badge tono={c.etapa === "CERRADO" ? "pagado" : PROSPECTO.has(c.etapa) ? "prospecto" : "tramite"}>{NOMBRE_ETAPA[c.etapa as keyof typeof NOMBRE_ETAPA] ?? c.etapa}</Badge></span>
                    <span className="cifra text-right text-ink">{monto !== undefined ? mxn(monto) : c.esperado !== null ? <span className="text-xs text-ink-muted">Afore {mxn(c.esperado)}</span> : <span className="text-xs text-ink-muted">por definir</span>}</span>
                    <Link href={`/casos/${c.id}`} className="text-xs text-brand underline md:text-right">Abrir expediente</Link>
                  </div>
                  {/* Referencias personales: nombre, parentesco y teléfono (se editan en Datos personales). */}
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
                    <span className="font-medium text-ink">Referencias:</span>
                    {c.persona.referencias.length === 0 && <span>sin capturar</span>}
                    {c.persona.referencias.map((r) => (
                      <span key={r.orden}>
                        <span className="text-ink">{r.nombre}</span>
                        {r.parentesco && <> · {NOMBRE_PARENTESCO[r.parentesco] ?? r.parentesco}</>}
                        {r.telefono && <> · <a href={`tel:${r.telefono}`} className="cifra text-brand hover:underline">{local(r.telefono)}</a></>}
                        {r.confirmada_at && <span className="text-exito-texto"> ✓</span>}
                      </span>
                    ))}
                    <Link href={`/casos/${c.id}?tab=datos`} className="text-brand underline">{c.persona.referencias.length ? "Editar referencias" : "Agregar referencias"}</Link>
                  </div>
                  <details className="mt-2">
                    <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-brand"><Pencil className="size-3.5" aria-hidden /> Editar</summary>
                    <div className="mt-2 rounded-[var(--radius-boton)] bg-slate-50 p-3">
                      <FormularioAccion accion={editarProspecto.bind(null, c.id)} etiquetas={ETIQUETAS}>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <CampoTexto id="nombre" etiqueta="Nombre(s)" placeholder="Sin apellidos" valor={c.persona.nombre} required />
                          <CampoTexto id="apellido_paterno" etiqueta="Apellido paterno" valor={c.persona.apellido_paterno} />
                          <CampoTexto id="apellido_materno" etiqueta="Apellido materno" valor={c.persona.apellido_materno} />
                          <CampoTexto id="whatsapp" etiqueta="WhatsApp" ayuda="10 dígitos" tipo="tel" inputMode="tel" valor={local(c.persona.whatsapp)} />
                          <Seleccion id="socio_id" etiqueta="Asesor de pensiones" valor={c.socio_id} vacia="Ninguno" opciones={opcionesSocio} />
                          <Seleccion id="referidor_id" etiqueta="Referidor" valor={c.referidor_id} vacia="Ninguno" opciones={opcionesReferidor} />
                        </div>
                      </FormularioAccion>
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Desplegable>
  );
}
