// Reporte en PDF (10.8): la misma tabla de la pantalla, con la marca y el periodo.
import "server-only";
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { Columna } from "@/lib/exportar/excel";
import { formatear } from "@/lib/formato";
import { base, EncabezadoPdf, PiePdf } from "./componentes";
import { COLOR, registrarFuentes } from "./marca";

type Datos = { titulo: string; descripcion: string; periodo: string; emitido: string; columnas: Columna[]; filas: Record<string, string | number | null>[]; totales?: Record<string, number> };

const s = StyleSheet.create({
  enc: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: COLOR.azul, paddingBottom: 3, marginTop: 16, fontSize: 8, color: COLOR.gris },
  fila: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: COLOR.borde, paddingVertical: 4 },
  total: { flexDirection: "row", paddingTop: 5, fontWeight: 600 },
});

function ReportePdf(d: Datos) {
  const anchos = d.columnas.map((c) => (c.ancho ?? 12));
  const suma = anchos.reduce((a, b) => a + b, 0);
  const w = (i: number) => `${(anchos[i] / suma) * 100}%`;
  const der = (c: Columna) => c.tipo && c.tipo !== "texto";
  return (
    <Document title={d.titulo} author="RetiroPorDesempleo.com" language="es-MX">
      <Page size="LETTER" style={base.pagina}>
        <EncabezadoPdf etiqueta="Reporte" valor={d.periodo} fecha={`Emitido el ${d.emitido}`} />
        <Text style={base.titulo}>{d.titulo}</Text>
        <Text style={base.sub}>{d.descripcion}</Text>
        <View style={s.enc} fixed>{d.columnas.map((c, i) => <Text key={c.clave} style={{ width: w(i), textAlign: der(c) ? "right" : "left", paddingRight: 4 }}>{c.titulo}</Text>)}</View>
        {d.filas.length === 0 && <Text style={{ color: COLOR.gris, marginTop: 8 }}>Sin datos en el periodo.</Text>}
        {d.filas.map((f, j) => (
          <View key={j} style={s.fila} wrap={false}>
            {d.columnas.map((c, i) => <Text key={c.clave} style={{ width: w(i), textAlign: der(c) ? "right" : "left", paddingRight: 4 }}>{formatear(f[c.clave], c.tipo)}</Text>)}
          </View>
        ))}
        {d.totales && (
          <View style={s.total}>
            {d.columnas.map((c, i) => <Text key={c.clave} style={{ width: w(i), textAlign: der(c) ? "right" : "left", paddingRight: 4 }}>{i === 0 ? "Total" : d.totales![c.clave] !== undefined ? formatear(d.totales![c.clave], c.tipo) : ""}</Text>)}
          </View>
        )}
        <PiePdf />
      </Page>
    </Document>
  );
}

export async function generarReportePdf(d: Datos): Promise<Buffer> {
  registrarFuentes();
  return renderToBuffer(<ReportePdf {...d} />);
}
