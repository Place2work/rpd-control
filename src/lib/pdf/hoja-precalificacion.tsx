// Hoja de precalificación (10.4 y 11.4): logo, folio, fecha, las dos modalidades con sus
// semanas, honorario y el pie de contacto. Todo marcado como estimado.
import "server-only";
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { Impacto, OpcionModalidad } from "@/lib/reglas/retiro";
import { COLOR, LOGO, PIE, registrarFuentes } from "./marca";

export type DatosHoja = {
  folio: string;
  fecha: string; // ya formateada
  cliente: string;
  regimen: string;
  resultado: string;
  explicacion: string;
  semanasTotales: number;
  saldoRcv: number;
  opciones: OpcionModalidad[];
  elegida: "A" | "B" | null;
  impacto: Impacto | null;
  tareas: string[];
  umaMensual: number;
};

const mxn = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const sem = (n: number) => n.toLocaleString("es-MX", { maximumFractionDigits: 1 });

const s = StyleSheet.create({
  pagina: { fontFamily: "Inter", fontSize: 10, color: COLOR.tinta, paddingTop: 36, paddingBottom: 70, paddingHorizontal: 40 },
  encabezado: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: COLOR.azul },
  logo: { width: 170 },
  folio: { textAlign: "right", fontSize: 9, color: COLOR.gris },
  folioNum: { fontFamily: "Poppins", fontWeight: 600, fontSize: 12, color: COLOR.azul },
  titulo: { fontFamily: "Poppins", fontWeight: 600, fontSize: 18, marginTop: 18 },
  sub: { color: COLOR.gris, marginTop: 2 },
  resultado: { marginTop: 14, padding: 12, backgroundColor: COLOR.azulTenue, borderRadius: 6 },
  parrafo: { fontSize: 10.5, lineHeight: 1.3 },
  etiqueta: { fontFamily: "Poppins", fontWeight: 600, fontSize: 10, color: COLOR.azul, marginBottom: 4 },
  columnas: { flexDirection: "row", gap: 12, marginTop: 14 },
  tarjeta: { flex: 1, padding: 12, borderWidth: 1, borderColor: COLOR.borde, borderRadius: 8 },
  tarjetaElegida: { borderWidth: 2, borderColor: COLOR.azul },
  monto: { fontFamily: "Poppins", fontWeight: 600, fontSize: 20, marginVertical: 6 },
  fila: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2.5 },
  gris: { color: COLOR.gris },
  neto: { color: COLOR.verde, fontWeight: 600 },
  nota: { fontSize: 8, color: COLOR.gris, marginTop: 6, lineHeight: 1.4 },
  seccion: { marginTop: 14 },
  aviso: { marginTop: 14, padding: 10, borderRadius: 6, borderWidth: 1 },
  pie: { position: "absolute", bottom: 24, left: 40, right: 40, borderTopWidth: 1, borderTopColor: COLOR.borde, paddingTop: 6, fontSize: 7.5, color: COLOR.gris, textAlign: "center", lineHeight: 1.4 },
});

function Modalidad({ m, o, elegida }: { m: "A" | "B"; o: OpcionModalidad | undefined; elegida: boolean }) {
  return (
    <View style={[s.tarjeta, ...(elegida ? [s.tarjetaElegida] : [])]}>
      <Text style={{ fontFamily: "Poppins", fontWeight: 600, fontSize: 12 }}>Modalidad {m}{elegida ? "  ·  elegida" : ""}</Text>
      {!o ? (
        <Text style={[s.gris, { marginTop: 8 }]}>{m === "A" ? "No califica: requiere 3 años de cuenta y 12 bimestres cotizados." : "No califica: requiere 5 años de cuenta."}</Text>
      ) : (
        <>
          <Text style={s.monto}>{mxn(o.monto)} <Text style={{ fontSize: 9, color: COLOR.gris, fontFamily: "Inter" }}>estimado</Text></Text>
          {[
            ["Semanas que se descuentan", sem(o.semanasPerdidas)],
            ["Quedarías con", `${sem(o.semanasDespues)} semanas`],
            ["Porcentaje del saldo", `${o.pctSaldo.toLocaleString("es-MX")}%`],
            ["Honorario (IVA incluido)", mxn(o.honorario)],
          ].map(([t, v]) => (
            <View key={t} style={s.fila}><Text style={s.gris}>{t}</Text><Text>{v}</Text></View>
          ))}
          <View style={[s.fila, { borderTopWidth: 1, borderTopColor: COLOR.borde, marginTop: 4, paddingTop: 5 }]}>
            <Text style={s.neto}>Recibirías aproximadamente</Text><Text style={s.neto}>{mxn(o.netoCliente)}</Text>
          </View>
          <Text style={s.nota}>{m === "A" ? "Un solo pago. Menor entre 30 días de tu salario, 10 UMA y tu saldo." : "Hasta 6 mensualidades. Menor entre 90 días de tu salario promedio y 11.5% de tu saldo."}</Text>
        </>
      )}
    </View>
  );
}

function Hoja(d: DatosHoja) {
  return (
    <Document title={`Precalificación ${d.folio}`} author="RetiroPorDesempleo.com" language="es-MX">
      <Page size="LETTER" style={s.pagina}>
        <View style={s.encabezado}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- Image de react-pdf no acepta alt */}
          <Image src={LOGO} style={s.logo} />
          <View>
            <Text style={s.folio}>Folio</Text>
            <Text style={s.folioNum}>{d.folio}</Text>
            <Text style={s.folio}>{d.fecha}</Text>
          </View>
        </View>

        <Text style={s.titulo}>Hoja de precalificación</Text>
        <Text style={s.sub}>{d.cliente} · {d.regimen} · {sem(d.semanasTotales)} semanas cotizadas · saldo RCV {mxn(d.saldoRcv)}</Text>

        <View style={s.resultado}>
          <Text style={s.etiqueta}>{d.resultado}</Text>
          <Text style={s.parrafo}>{d.explicacion}</Text>
        </View>

        <View style={s.columnas}>
          {(["A", "B"] as const).map((m) => (
            <Modalidad key={m} m={m} o={d.opciones.find((o) => o.modalidad === m)} elegida={d.elegida === m} />
          ))}
        </View>

        {d.impacto && d.impacto.mensajes.length > 0 && (
          <View style={[s.aviso, { borderColor: d.impacto.severidad === "critica" ? COLOR.rojo : COLOR.ambar }]}>
            <Text style={[s.etiqueta, { color: d.impacto.severidad === "critica" ? COLOR.rojo : COLOR.ambar }]}>Lo que pasa con tu pensión</Text>
            {d.impacto.mensajes.map((m) => <Text key={m} style={{ marginBottom: 2 }}>• {m}</Text>)}
          </View>
        )}

        {d.tareas.length > 0 && (
          <View style={s.seccion}>
            <Text style={s.etiqueta}>Antes de ingresar tu solicitud</Text>
            {d.tareas.map((t) => <Text key={t} style={{ marginBottom: 2 }}>• {t}</Text>)}
          </View>
        )}

        <Text style={[s.nota, { marginTop: 16 }]}>
          Montos y semanas estimados con la información de tu constancia de semanas y tu estado de cuenta, y la UMA mensual vigente
          ({mxn(d.umaMensual)}). El monto definitivo lo determina tu Afore. El retiro por desempleo descuenta semanas de cotización
          en proporción al saldo retirado (art. 198 de la Ley del Seguro Social). Nuestro honorario es el 30% de lo que pague la Afore, IVA incluido.
        </Text>

        <View style={s.pie} fixed>
          {PIE.map((l) => <Text key={l}>{l}</Text>)}
        </View>
      </Page>
    </Document>
  );
}

export async function generarHojaPrecalificacion(d: DatosHoja): Promise<Buffer> {
  registrarFuentes();
  return renderToBuffer(<Hoja {...d} />);
}
