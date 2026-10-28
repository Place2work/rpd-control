// Contrato y aviso de privacidad en PDF desde la plantilla (10.4). Reproduce el formato de los
// contratos de Irving: título centrado, declaraciones, cláusulas con incisos, firmas y pie con página.
import "server-only";
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/stylesheet";
import { negritas, type Bloque } from "@/lib/contratos/plantilla";
import type { Clase, Firma } from "@/lib/contratos/datos";
import { COLOR, LOGO, registrarFuentes } from "./marca";

const s = StyleSheet.create({
  pagina: { fontFamily: "Inter", fontSize: 9.5, color: COLOR.tinta, paddingTop: 34, paddingBottom: 54, paddingHorizontal: 52 },
  logo: { width: 120, alignSelf: "center", marginBottom: 10 },
  titulo: { fontFamily: "Poppins", fontWeight: 600, fontSize: 11.5, textAlign: "center", color: COLOR.azul },
  subtitulo: { textAlign: "center", fontSize: 9.5, marginTop: 3, marginBottom: 10, color: COLOR.gris },
  seccion: { fontFamily: "Poppins", fontWeight: 600, fontSize: 10.5, textAlign: "center", marginTop: 10, marginBottom: 4 },
  clausula: { fontWeight: 600, marginTop: 8, marginBottom: 2 },
  // El interlineado va en cada texto: puesto en la página, react-pdf deja de dibujar el pie fijo.
  parrafo: { textAlign: "justify", marginBottom: 4, lineHeight: "12.8pt" },
  apartado: { fontWeight: 600, marginTop: 4, marginBottom: 2 },
  inciso: { flexDirection: "row", marginBottom: 2.5, paddingLeft: 12 },
  etiqueta: { width: 16 },
  casilla: { flexDirection: "row", alignItems: "center", marginBottom: 3 },
  cuadro: { width: 8, height: 8, borderWidth: 0.8, borderColor: COLOR.tinta, marginRight: 6 },
  firmas: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginTop: 26, rowGap: 30 },
  firma: { width: "45%", alignItems: "center", textAlign: "center" },
  linea: { borderTopWidth: 0.8, borderTopColor: COLOR.tinta, width: "100%", marginBottom: 4 },
  avisoFirma: { flexDirection: "row", marginTop: 14, fontSize: 9 },
  pie: { position: "absolute", bottom: 22, left: 52, right: 52, fontSize: 7.5, color: COLOR.gris, textAlign: "center" },
});

function Texto({ texto, estilo }: { texto: string; estilo?: Style }) {
  return <Text style={estilo}>{negritas(texto).map((t, i) => <Text key={i} style={t.negrita ? { fontWeight: 600 } : undefined}>{t.texto}</Text>)}</Text>;
}

function Firmas({ clase, firmas, fecha }: { clase: Clase; firmas: Firma[]; fecha: string }) {
  if (clase === "aviso_privacidad") {
    const [a, m, d] = fecha.split("-");
    return (
      <View>
        {firmas.map((f) => (
          <View key={f.titulo} style={s.avisoFirma} wrap={false}>
            <Text style={{ width: "48%" }}>Nombre: {f.nombre ?? "________________"} ({f.titulo})</Text>
            <Text style={{ width: "30%" }}>Firma: __________________</Text>
            <Text style={{ width: "22%" }}>Fecha: {d} / {m} / {a}</Text>
          </View>
        ))}
      </View>
    );
  }
  return (
    <View style={s.firmas} wrap={false}>
      {firmas.map((f) => (
        <View key={f.titulo} style={s.firma}>
          <View style={s.linea} />
          <Text style={{ fontWeight: 600 }}>{f.titulo}</Text>
          {f.nombre && <Text>{f.nombre}</Text>}
          {f.detalle && <Text style={{ fontSize: 8.5 }}>{f.detalle}</Text>}
        </View>
      ))}
    </View>
  );
}

type Props = { clase: Clase; titulo: string; pie: string; bloques: Bloque[]; firmas: Firma[]; fecha: string };

function Documento({ clase, titulo, pie, bloques, firmas, fecha }: Props) {
  return (
    <Document title={titulo} author="RetiroPorDesempleo.com" language="es-MX">
      <Page size="LETTER" style={s.pagina}>
        <Text style={s.pie} fixed render={({ pageNumber }) => `${pie} · Página ${pageNumber}`} />
        {/* eslint-disable-next-line jsx-a11y/alt-text -- Image de react-pdf no acepta alt */}
        <Image src={LOGO} style={s.logo} />
        {bloques.map((b, i) => {
          switch (b.tipo) {
            case "titulo": return <Texto key={i} texto={b.texto} estilo={s.titulo} />;
            case "subtitulo": return <Texto key={i} texto={b.texto} estilo={s.subtitulo} />;
            case "seccion": return <Texto key={i} texto={b.texto} estilo={s.seccion} />;
            case "clausula": return <View key={i} wrap={false} minPresenceAhead={40}><Texto texto={b.texto} estilo={s.clausula} /></View>;
            case "apartado": return <Texto key={i} texto={b.texto} estilo={s.apartado} />;
            case "parrafo": return <Texto key={i} texto={b.texto} estilo={s.parrafo} />;
            case "inciso": return (
              <View key={i} style={s.inciso} wrap={false}>
                <Text style={s.etiqueta}>{b.etiqueta}</Text>
                <View style={{ flex: 1 }}><Texto texto={b.texto} estilo={{ textAlign: "justify", lineHeight: "12.8pt" }} /></View>
              </View>
            );
            case "casilla": return <View key={i} style={s.casilla} wrap={false}><View style={s.cuadro} /><Texto texto={b.texto} /></View>;
            case "firmas": return <Firmas key={i} clase={clase} firmas={firmas} fecha={fecha} />;
            case "salto": return <View key={i} break />;
          }
        })}
      </Page>
    </Document>
  );
}

export async function generarContratoPdf(p: Props): Promise<Buffer> {
  registrarFuentes();
  return renderToBuffer(<Documento {...p} />);
}
