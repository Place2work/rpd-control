"use client";

// Barras de una sola serie (magnitud por categoría o por mes). Siempre va acompañada de su
// tabla en la misma pantalla, así que no hace falta leyenda: el título nombra la serie.
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Props = {
  datos: { etiqueta: string; valor: number }[];
  formato?: "pesos" | "numero" | "porcentaje" | "dias";
  color?: "marca" | "exito";
  alto?: number;
  horizontal?: boolean;
};

const fmt = (f: Props["formato"]) => (v: number) =>
  f === "pesos" ? v.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 })
    : f === "porcentaje" ? `${(v * 100).toLocaleString("es-MX", { maximumFractionDigits: 1 })}%`
      : f === "dias" ? `${v.toLocaleString("es-MX", { maximumFractionDigits: 1 })} días`
        : v.toLocaleString("es-MX", { maximumFractionDigits: 1 });

export function GraficaBarras({ datos, formato = "numero", color = "marca", alto = 240, horizontal = false }: Props) {
  const f = fmt(formato);
  const relleno = color === "exito" ? "var(--color-exito, #5E9E3A)" : "var(--color-brand, #004AAD)";
  const eje = { fontSize: 12, fill: "var(--color-ink-muted, #64748B)" };
  return (
    <div style={{ height: horizontal ? Math.max(alto, datos.length * 34 + 30) : alto }} role="img" aria-label="Gráfica; los mismos datos están en la tabla">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={datos} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 8, right: 16, bottom: 0, left: 0 }} barCategoryGap={horizontal ? 6 : "28%"}>
          <CartesianGrid stroke="var(--color-borde, #E2E8F0)" strokeDasharray="0" vertical={horizontal} horizontal={!horizontal} />
          {horizontal ? (
            <>
              <XAxis type="number" allowDecimals={formato !== "numero"} tickFormatter={f} tick={eje} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="etiqueta" width={150} tick={eje} axisLine={false} tickLine={false} />
            </>
          ) : (
            <>
              <XAxis dataKey="etiqueta" tick={eje} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis allowDecimals={formato !== "numero"} tickFormatter={f} tick={eje} axisLine={false} tickLine={false} width={72} />
            </>
          )}
          <Tooltip cursor={{ fill: "var(--color-brand-tint, #E8F0FB)" }} formatter={(v) => [f(Number(v)), ""]} separator=""
            contentStyle={{ borderRadius: 8, border: "1px solid var(--color-borde, #E2E8F0)", fontSize: 13 }} />
          <Bar dataKey="valor" fill={relleno} maxBarSize={horizontal ? 22 : 36} radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
