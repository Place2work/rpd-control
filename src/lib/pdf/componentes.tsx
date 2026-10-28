// Encabezado y pie de marca de todos los PDF (11.4): logo, línea azul, folio/fecha y contacto.
import "server-only";
import { Image, StyleSheet, Text, View } from "@react-pdf/renderer";
import { COLOR, LOGO, PIE } from "./marca";

export const base = StyleSheet.create({
  pagina: { fontFamily: "Inter", fontSize: 10, color: COLOR.tinta, paddingTop: 36, paddingBottom: 70, paddingHorizontal: 40 },
  encabezado: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: COLOR.azul },
  logo: { width: 170 },
  dato: { textAlign: "right", fontSize: 9, color: COLOR.gris },
  datoFuerte: { textAlign: "right", fontFamily: "Poppins", fontWeight: 600, fontSize: 12, color: COLOR.azul },
  titulo: { fontFamily: "Poppins", fontWeight: 600, fontSize: 18, marginTop: 18 },
  sub: { color: COLOR.gris, marginTop: 2 },
  pie: { position: "absolute", bottom: 24, left: 40, right: 40, borderTopWidth: 1, borderTopColor: COLOR.borde, paddingTop: 6, fontSize: 7.5, color: COLOR.gris, textAlign: "center", lineHeight: 1.4 },
});

export function EncabezadoPdf({ etiqueta, valor, fecha }: { etiqueta: string; valor: string; fecha: string }) {
  return (
    <View style={base.encabezado}>
      {/* eslint-disable-next-line jsx-a11y/alt-text -- Image de react-pdf no acepta alt */}
      <Image src={LOGO} style={base.logo} />
      <View>
        <Text style={base.dato}>{etiqueta}</Text>
        <Text style={base.datoFuerte}>{valor}</Text>
        <Text style={base.dato}>{fecha}</Text>
      </View>
    </View>
  );
}

export function PiePdf() {
  return (
    <View style={base.pie} fixed>
      {PIE.map((l) => <Text key={l}>{l}</Text>)}
      <Text render={({ pageNumber, totalPages }) => (totalPages > 1 ? `Página ${pageNumber} de ${totalPages}` : "")} />
    </View>
  );
}
