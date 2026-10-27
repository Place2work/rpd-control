// Tarea diaria (sección 8). La dispara app.disparar_tareas() desde pg_cron cuando en CDMX
// ya son las 07:00 (alertas) o las 07:15 (correo). Idempotente: una corrida por tarea y día.
import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { prismaSistema } from "@/lib/db/prisma";
import { hoyCDMX } from "@/lib/tiempo";

const TAREAS = ["ALERTAS_DIARIAS", "CORREO_RESUMEN"] as const;

function autorizado(req: NextRequest): boolean {
  const esperado = process.env.CRON_SECRETO;
  const recibido = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!esperado || recibido.length !== esperado.length) return false;
  return timingSafeEqual(Buffer.from(recibido), Buffer.from(esperado));
}

export async function POST(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const tarea = req.nextUrl.searchParams.get("tarea") as (typeof TAREAS)[number] | null;
  if (!tarea || !TAREAS.includes(tarea)) return NextResponse.json({ error: "Tarea desconocida" }, { status: 400 });

  try {
    return await ejecutar(tarea);
  } catch (e) {
    // Quien llega aquí ya se autenticó con CRON_SECRETO: se le devuelve el motivo para
    // diagnosticar (sin la cadena de conexión), y el detalle completo queda en los logs.
    console.error("[cron/diaria]", e);
    const err = e as { name?: string; code?: string; message?: string };
    const mensaje = (err.message ?? "").replace(/postgres(ql)?:\/\/[^\s"']+/g, "[conexión oculta]").slice(0, 400);
    return NextResponse.json({ tarea, estado: "error", tipo: err.name, codigo: err.code, mensaje }, { status: 500 });
  }
}

async function ejecutar(tarea: (typeof TAREAS)[number]) {
  const fecha = hoyCDMX();
  const fecha_cdmx = new Date(`${fecha}T00:00:00Z`);
  const previa = await prismaSistema.ejecucionTarea.findUnique({ where: { tarea_fecha_cdmx: { tarea, fecha_cdmx } } });
  if (previa?.terminada_at) return NextResponse.json({ tarea, fecha, estado: "ya_ejecutada" });

  await prismaSistema.ejecucionTarea.upsert({
    where: { tarea_fecha_cdmx: { tarea, fecha_cdmx } },
    update: { iniciada_at: new Date() },
    create: { tarea, fecha_cdmx },
  });

  // Fase 0: sin reglas de negocio todavía. La fase 1 genera aquí las alertas de 8.1
  // y el correo de resumen con Resend.
  const resultado = { fase: 0, mensaje: "Tarea registrada; las reglas de alertas llegan en la fase 1" };

  await prismaSistema.ejecucionTarea.update({
    where: { tarea_fecha_cdmx: { tarea, fecha_cdmx } },
    data: { terminada_at: new Date(), resultado },
  });
  return NextResponse.json({ tarea, fecha, estado: "ejecutada", resultado });
}
