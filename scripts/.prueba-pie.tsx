import { Document, Page, Text, View, renderToFile } from "@react-pdf/renderer";
const casos: [string, object][] = [
  ["a-sin-lineheight", { fontSize: 9.5, paddingTop: 34, paddingBottom: 54, paddingHorizontal: 52 }],
  ["b-con-lineheight", { fontSize: 9.5, paddingTop: 34, paddingBottom: 54, paddingHorizontal: 52, lineHeight: 1.35 }],
];
const pie = { position: "absolute" as const, bottom: 22, left: 52, right: 52, fontSize: 7.5, textAlign: "center" as const };
(async () => {
  for (const [n, est] of casos) {
    await renderToFile(<Document><Page size="LETTER" style={est}>
      <Text style={pie} fixed render={({ pageNumber }) => `PIE Página ${pageNumber}`} />
      {Array.from({ length: 120 }, (_, i) => <View key={i} wrap={false}><Text>Renglón {i}</Text></View>)}
    </Page></Document>, `/tmp/claude-0/-home-user-rpd-control/b0517b66-c052-582e-b686-c80b20187053/scratchpad/${n}.pdf`);
  }
})();
