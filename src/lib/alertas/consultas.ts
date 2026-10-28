import "server-only";
import type { Sesion } from "@/lib/auth/sesion";
import { conUsuario, prismaSistema } from "@/lib/db/prisma";

const ORDEN = { critica: 0, aviso: 1, info: 2 } as const;

// Mensaje de WhatsApp al cliente que corresponde a cada alerta (8.2 y 8.3).
const PLANTILLA_POR_REGLA: Record<string, string> = {
  DIA46_HOY: "YA_PUEDES_RETIRAR",
  DIA46_PROXIMO: "FALTAN_DIAS",
  EXPEDIENTE_DETENIDO: "DOCS_PENDIENTES",
  DOC_POR_VENCER: "DOCS_PENDIENTES",
  PROSPECTO_SIN_CONTACTO: "BIENVENIDA",
};

export async function misAlertas({ claims, ip, usuario }: Sesion) {
  const [alertas, plantillas] = await Promise.all([
    conUsuario(claims, (tx) => tx.alerta.findMany({
      where: { asignado_a: usuario.id, estado: "activa" },
      include: { caso: { select: { id: true, folio: true, persona: { select: { nombre: true, whatsapp: true } } } } },
      orderBy: { fecha_disparo: "desc" },
      take: 100,
    }), ip),
    prismaSistema.plantillaMensaje.findMany({ where: { activo: true, canal: "whatsapp" } }),
  ]);
  const cuerpo = new Map(plantillas.map((p) => [p.clave, p.cuerpo]));
  return alertas
    .sort((a, b) => ORDEN[a.severidad] - ORDEN[b.severidad])
    .map((a) => {
      const clave = PLANTILLA_POR_REGLA[a.regla];
      const plantilla = clave ? cuerpo.get(clave) : undefined;
      const wa = a.caso?.persona.whatsapp?.replace("+", "");
      const texto = plantilla && a.caso
        ? plantilla.replaceAll("{nombre}", a.caso.persona.nombre).replaceAll("{folio}", a.caso.folio)
            .replace(/\{[a-z_]+\}/g, "").replace(/\s+/g, " ").trim()
        : null;
      return { id: a.id, regla: a.regla, severidad: a.severidad, mensaje: a.mensaje, casoId: a.caso?.id ?? null,
        whatsapp: wa && texto ? `https://wa.me/${wa}?text=${encodeURIComponent(texto)}` : null };
    });
}

export async function contarMisAlertas({ claims, ip, usuario }: Sesion): Promise<{ total: number; criticas: number }> {
  const r = await conUsuario(claims, (tx) => tx.alerta.groupBy({ by: ["severidad"], where: { asignado_a: usuario.id, estado: "activa" }, _count: true }), ip);
  return { total: r.reduce((s, x) => s + x._count, 0), criticas: r.find((x) => x.severidad === "critica")?._count ?? 0 };
}
