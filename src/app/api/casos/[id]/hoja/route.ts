// PDF de la hoja de precalificación del último cálculo del caso. RLS decide si se puede ver.
import { NextResponse, type NextRequest } from "next/server";
import { obtenerSesion } from "@/lib/auth/sesion";
import { conUsuario } from "@/lib/db/prisma";
import { parametrosDinero } from "@/lib/parametros";
import { generarHojaPrecalificacion } from "@/lib/pdf/hoja-precalificacion";
import type { Impacto, OpcionModalidad, Resultado } from "@/lib/reglas/retiro";

const RESULTADO: Record<Resultado, string> = {
  APTO: "Puedes hacer el retiro", APTO_BLOQUEADO: "Puedes hacer el retiro, con trámites pendientes", NO_TODAVIA: "Todavía no puedes retirar",
  CALIFICA_NO_CONVIENE: "Calificas, pero no te conviene", NO_ELEGIBLE_DESVIO: "Te conviene otro servicio", NO_ELEGIBLE_DEFINITIVO: "No es posible el retiro",
};
const REGIMEN: Record<string, string> = { L73: "Ley 73", L97: "Ley 97", por_definir: "Régimen por definir" };

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { claims, ip } = await obtenerSesion();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("No encontrado", { status: 404 });

  const caso = await conUsuario(claims, (tx) => tx.caso.findUnique({
    where: { id },
    select: {
      folio: true, persona: { select: { nombre: true, apellido_paterno: true, apellido_materno: true } },
      datos_imss: { select: { regimen: true } },
      calculos: { orderBy: { created_at: "desc" }, take: 1 },
    },
  }), ip);
  const c = caso?.calculos[0];
  if (!caso || !c) return new NextResponse("Primero calcula la precalificación.", { status: 404 });

  const g = c.impacto_pension as { opciones: OpcionModalidad[]; porDefecto: "A" | "B" | null; impacto: Impacto | null; tareas: string[] } | null;
  const entradas = c.entradas as { semanasTotales: number; saldoRcv: number; parametros?: { HONORARIO_RETIRO_PCT?: number } };
  const pdf = await generarHojaPrecalificacion({
    folio: caso.folio,
    fecha: new Intl.DateTimeFormat("es-MX", { dateStyle: "long", timeZone: "UTC" }).format(c.fecha_calculo),
    cliente: [caso.persona.nombre, caso.persona.apellido_paterno, caso.persona.apellido_materno].filter(Boolean).join(" "),
    regimen: REGIMEN[caso.datos_imss?.regimen ?? "por_definir"],
    resultado: RESULTADO[c.resultado],
    explicacion: c.explicacion,
    semanasTotales: entradas.semanasTotales,
    saldoRcv: entradas.saldoRcv,
    opciones: g?.opciones ?? [],
    elegida: (c.modalidad_elegida as "A" | "B" | null) ?? g?.porDefecto ?? null,
    impacto: g?.impacto ?? null,
    tareas: g?.tareas ?? [],
    umaMensual: Number(c.uma_mensual),
    // El porcentaje con que se hizo el cálculo, no el de hoy.
    honorarioPct: entradas.parametros?.HONORARIO_RETIRO_PCT ?? (await parametrosDinero(c.fecha_calculo.toISOString().slice(0, 10))).HONORARIO_RETIRO_PCT,
  });
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Precalificacion-${caso.folio}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
