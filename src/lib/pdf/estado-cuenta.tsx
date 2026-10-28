// Estado de cuenta de comisiones (9.3): lo devengado del mes caso por caso, lo pagado con su
// referencia y lo estimado que viene en camino. Los totales cuadran al centavo con los renglones.
import "server-only";
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { base, EncabezadoPdf, PiePdf } from "./componentes";
import { COLOR, registrarFuentes } from "./marca";

export type RenglonEstado = { fecha: string; folio: string; cliente: string; concepto: string; regla: string; estado: string; monto: number };
export type DatosEstadoCuenta = {
  beneficiario: string;
  tipo: string;
  mes: string; // "Octubre de 2026"
  emitido: string;
  devengadas: RenglonEstado[];
  estimadas: RenglonEstado[];
  pagos: { fecha: string; metodo: string; referencia: string | null; total: number }[];
  totales: { devengadoMes: number; pagado: number; porPagar: number; estimado: number };
};

const mxn = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const s = StyleSheet.create({
  cifras: { flexDirection: "row", gap: 10, marginTop: 14 },
  cifra: { flex: 1, padding: 10, borderRadius: 6, backgroundColor: COLOR.azulTenue },
  cifraT: { fontSize: 8.5, color: COLOR.gris },
  cifraV: { fontFamily: "Poppins", fontWeight: 600, fontSize: 14, marginTop: 2 },
  seccion: { fontFamily: "Poppins", fontWeight: 600, fontSize: 11, color: COLOR.azul, marginTop: 16, marginBottom: 6 },
  fila: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: COLOR.borde, paddingVertical: 4 },
  enc: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: COLOR.azul, paddingBottom: 3, fontSize: 8, color: COLOR.gris },
  total: { flexDirection: "row", paddingTop: 5, fontWeight: 600 },
  vacio: { color: COLOR.gris, fontSize: 9 },
  nota: { fontSize: 8, color: COLOR.gris, marginTop: 14, lineHeight: 1.4 },
});
const COL = [{ w: 58, t: "Fecha" }, { w: 52, t: "Folio" }, { w: 100, t: "Cliente" }, { w: 160, t: "Regla" }, { w: 52, t: "Estado" }, { w: 70, t: "Monto", der: true }];

function Tabla({ filas, total }: { filas: RenglonEstado[]; total?: number }) {
  if (!filas.length) return <Text style={s.vacio}>Sin movimientos.</Text>;
  return (
    <View>
      <View style={s.enc}>{COL.map((c) => <Text key={c.t} style={{ width: c.w, textAlign: c.der ? "right" : "left" }}>{c.t}</Text>)}</View>
      {filas.map((f, i) => (
        <View key={i} style={s.fila} wrap={false}>
          {[f.fecha, f.folio, f.cliente, f.regla, f.estado, mxn(f.monto)].map((v, j) => (
            <Text key={j} style={{ width: COL[j].w, textAlign: COL[j].der ? "right" : "left", fontSize: j === 3 ? 8 : 9, color: j === 3 ? COLOR.gris : COLOR.tinta, paddingRight: 4 }}>{v}</Text>
          ))}
        </View>
      ))}
      {total !== undefined && (
        <View style={s.total}><Text style={{ width: 422 }}>Total</Text><Text style={{ width: 70, textAlign: "right" }}>{mxn(total)}</Text></View>
      )}
    </View>
  );
}

function EstadoCuenta(d: DatosEstadoCuenta) {
  return (
    <Document title={`Estado de cuenta ${d.beneficiario} ${d.mes}`} author="RetiroPorDesempleo.com" language="es-MX">
      <Page size="LETTER" style={base.pagina}>
        <EncabezadoPdf etiqueta="Estado de cuenta" valor={d.mes} fecha={`Emitido el ${d.emitido}`} />
        <Text style={base.titulo}>{d.beneficiario}</Text>
        <Text style={base.sub}>{d.tipo} · comisiones del mes</Text>

        <View style={s.cifras}>
          {[["Devengado en el mes", d.totales.devengadoMes], ["Pagado", d.totales.pagado], ["Por pagar", d.totales.porPagar], ["Estimado en camino", d.totales.estimado]].map(([t, v]) => (
            <View key={t as string} style={s.cifra}><Text style={s.cifraT}>{t}</Text><Text style={s.cifraV}>{mxn(v as number)}</Text></View>
          ))}
        </View>

        <Text style={s.seccion}>Comisiones devengadas del mes</Text>
        <Tabla filas={d.devengadas} total={d.totales.devengadoMes} />

        {d.pagos.length > 0 && (
          <>
            <Text style={s.seccion}>Pagos realizados</Text>
            {d.pagos.map((p, i) => (
              <View key={i} style={s.fila}>
                <Text style={{ width: 90 }}>{p.fecha}</Text>
                <Text style={{ width: 100 }}>{p.metodo}</Text>
                <Text style={{ width: 232, color: COLOR.gris }}>{p.referencia ?? "Sin referencia"}</Text>
                <Text style={{ width: 70, textAlign: "right" }}>{mxn(p.total)}</Text>
              </View>
            ))}
          </>
        )}

        <Text style={s.seccion}>Estimadas (todavía no entra el dinero)</Text>
        <Tabla filas={d.estimadas} />

        <Text style={s.nota}>
          Una comisión nace estimada al firmar el contrato, se devenga cuando entra el dinero que la origina y se paga en la
          liquidación del mes. Las estimadas no suman al total por pagar y pueden cambiar con el monto real que pague la Afore.
        </Text>
        <PiePdf />
      </Page>
    </Document>
  );
}

export async function generarEstadoCuenta(d: DatosEstadoCuenta): Promise<Buffer> {
  registrarFuentes();
  return renderToBuffer(<EstadoCuenta {...d} />);
}
