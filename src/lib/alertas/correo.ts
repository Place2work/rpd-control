// Correo de resumen diario (8.2): uno por usuario con sus críticas y avisos activos.
// Sin datos sensibles en el cuerpo: solo nombre y folio, con liga al caso.
import "server-only";
import { prismaSistema } from "@/lib/db/prisma";

const APP_URL = () => process.env.APP_URL ?? "https://rpd-control.vercel.app";
const escapar = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export async function enviarResumenes(hoy: string) {
  const llave = process.env.RESEND_API_KEY;
  if (!llave) return { enviados: 0, motivo: "Falta RESEND_API_KEY: el resumen se ve en la bandeja de Hoy" };
  const remitente = process.env.RESEND_FROM ?? "RPD Control <alertas@retiropordesempleo.com>";

  const alertas = await prismaSistema.alerta.findMany({
    where: { estado: "activa", severidad: { in: ["critica", "aviso"] } },
    include: { usuario: { select: { email: true, nombre: true, activo: true } } },
    orderBy: [{ severidad: "desc" }, { fecha_disparo: "desc" }],
  });
  const porUsuario = new Map<string, typeof alertas>();
  for (const a of alertas) if (a.usuario.activo) porUsuario.set(a.asignado_a, [...(porUsuario.get(a.asignado_a) ?? []), a]);

  let enviados = 0;
  for (const lista of porUsuario.values()) {
    const u = lista[0].usuario;
    const criticas = lista.filter((a) => a.severidad === "critica");
    const fila = (a: (typeof lista)[number]) =>
      `<li style="margin:6px 0"><a href="${APP_URL()}/casos/${a.caso_id}" style="color:#004AAD">${escapar(a.mensaje)}</a></li>`;
    const html = `<div style="font-family:Inter,Arial,sans-serif;color:#0F172A">
      <p>Hola ${escapar(u.nombre.split(" ")[0])}, esto es lo urgente de hoy (${hoy}):</p>
      ${criticas.length ? `<h3 style="color:#B91C1C">Críticas (${criticas.length})</h3><ul>${criticas.map(fila).join("")}</ul>` : ""}
      ${lista.length > criticas.length ? `<h3 style="color:#B45309">Avisos (${lista.length - criticas.length})</h3><ul>${lista.filter((a) => a.severidad === "aviso").map(fila).join("")}</ul>` : ""}
      <p><a href="${APP_URL()}/hoy" style="color:#004AAD">Abrir la bandeja de Hoy</a></p>
      <p style="color:#64748B;font-size:12px">RetiroPorDesempleo.com · uso interno</p></div>`;
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${llave}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: remitente, to: [u.email], subject: `RPD · ${criticas.length} críticas y ${lista.length - criticas.length} avisos de hoy`, html }),
    });
    if (r.ok) enviados += 1;
    else console.error("[correo-resumen]", u.email, r.status, await r.text());
  }
  return { enviados, usuarios: porUsuario.size };
}
