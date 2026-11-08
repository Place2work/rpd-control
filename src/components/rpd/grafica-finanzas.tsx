"use client";

// Gráficas de finanzas de Hoy. Colores validados para daltonismo (scripts del skill de visualización):
// ingreso azul de marca, descuento magenta, ganancia verde de marca; cobrado azul, proyectado verde.
// Las cifras también están en las tarjetas y en las tablas.
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MesFlujo, PasoCascada } from "@/lib/reglas/finanzas";

const C = { ingreso: "#004AAD", descuento: "#C2255C", total: "#5E9E3A", cobrado: "#004AAD", proyectado: "#5E9E3A" };
const eje = { fontSize: 12, fill: "#64748B" };
const tooltipEstilo = { borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 13 };
const pesos = (v: number) => v.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
// En pantallas angostas (celular) las etiquetas del eje se abrevian o se espacian para que no se encimen.
const ANGOSTO = 520;
const ABREV: Record<string, string> = { Proyectado: "Proyect.", Comisiones: "Comis.", Ganancia: "Ganan." };
const corto = (v: number) => (Math.abs(v) >= 1000 ? `$${(v / 1000).toLocaleString("es-MX", { maximumFractionDigits: 0 })}K` : `$${v.toLocaleString("es-MX")}`);

/** Cascada: de lo cobrado y proyectado a la ganancia. Cada barra lleva su monto (son 5). */
export function GraficaCascada({ pasos }: { pasos: PasoCascada[] }) {
  const [ancho, setAncho] = useState(800);
  const angosto = ancho < ANGOSTO;
  const datos = pasos.map((p) => ({ ...p, rotulo: `${p.tipo === "descuento" ? "−" : ""}${angosto ? corto(p.monto) : pesos(p.monto)}`,
    eje: angosto ? ABREV[p.etiqueta] ?? p.etiqueta : p.etiqueta }));
  return (
    <div style={{ height: 270 }} role="img" aria-label={`Cascada de la ganancia: ${datos.map((d) => `${d.etiqueta} ${d.rotulo}`).join(", ")}`}>
      <ResponsiveContainer width="100%" height="100%" onResize={(w) => setAncho(w)}>
        <BarChart data={datos} margin={{ top: 24, right: 8, bottom: 0, left: 0 }} barCategoryGap="30%">
          <CartesianGrid stroke="#E2E8F0" vertical={false} />
          <XAxis dataKey="eje" tick={{ ...eje, fontSize: angosto ? 11 : 12 }} axisLine={false} tickLine={false} interval={0} />
          <YAxis tickFormatter={corto} tick={eje} axisLine={false} tickLine={false} width={56} />
          <Tooltip cursor={{ fill: "#E8F0FB" }} contentStyle={tooltipEstilo}
            formatter={(_v, _n, item) => [(item.payload as { rotulo: string }).rotulo, ""]} separator="" />
          <Bar dataKey="base" stackId="c" fill="transparent" isAnimationActive={false} legendType="none" />
          <Bar dataKey="valor" stackId="c" maxBarSize={48} radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {datos.map((d) => <Cell key={d.etiqueta} fill={C[d.tipo]} />)}
            <LabelList dataKey="rotulo" position="top" style={{ fontSize: 12, fill: "#0F172A", fontWeight: 600 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Honorarios por mes: cobrados y proyectados, apilados (una sola escala). */
export function GraficaFlujo({ meses }: { meses: MesFlujo[] }) {
  const [ancho, setAncho] = useState(800);
  return (
    <div style={{ height: 270 }} role="img" aria-label="Honorarios por mes, cobrados y proyectados">
      <ResponsiveContainer width="100%" height="100%" onResize={(w) => setAncho(w)}>
        <BarChart data={meses} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="28%">
          <CartesianGrid stroke="#E2E8F0" vertical={false} />
          <XAxis dataKey="etiqueta" tick={{ ...eje, fontSize: 11 }} axisLine={false} tickLine={false} interval={ancho < ANGOSTO ? 1 : 0} />
          <YAxis tickFormatter={corto} tick={eje} axisLine={false} tickLine={false} width={56} />
          <Tooltip cursor={{ fill: "#E8F0FB" }} contentStyle={tooltipEstilo} formatter={(v, n) => [pesos(Number(v)), n === "cobrado" ? "Cobrado" : "Proyectado"]} />
          <Legend verticalAlign="top" align="right" height={28} iconType="square"
            formatter={(v) => <span style={{ color: "#0F172A", fontSize: 12 }}>{v === "cobrado" ? "Cobrado" : "Proyectado"}</span>} />
          <Bar dataKey="cobrado" stackId="m" fill={C.cobrado} maxBarSize={24} stroke="#FFFFFF" strokeWidth={1} isAnimationActive={false} />
          <Bar dataKey="proyectado" stackId="m" fill={C.proyectado} maxBarSize={24} radius={[4, 4, 0, 0]} stroke="#FFFFFF" strokeWidth={1} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
