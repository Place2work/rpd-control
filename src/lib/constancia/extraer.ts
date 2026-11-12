// Texto de un PDF acomodado por renglones (servidor). pdf.js entrega los textos en desorden; se agrupan por su
// altura en la página y se ordenan de izquierda a derecha, separados por « | » cuando hay un hueco grande.
import "server-only";
import { getDocumentProxy } from "unpdf";

type Pieza = { str: string; transform: number[]; width: number };

export async function renglonesDePdf(bytes: Uint8Array, maxPaginas = 40): Promise<string[]> {
  const pdf = await getDocumentProxy(bytes);
  const renglones: string[] = [];
  for (let n = 1; n <= Math.min(pdf.numPages, maxPaginas); n++) {
    const pagina = await pdf.getPage(n);
    const { items } = await pagina.getTextContent();
    const piezas = (items as Pieza[]).filter((i) => typeof i.str === "string" && i.str.trim().length > 0);
    const filas = new Map<number, Pieza[]>();
    for (const p of piezas) {
      const y = Math.round(p.transform[5] / 3) * 3; // tolerancia de 3 puntos
      const clave = [...filas.keys()].find((k) => Math.abs(k - y) <= 3) ?? y;
      filas.set(clave, [...(filas.get(clave) ?? []), p]);
    }
    for (const y of [...filas.keys()].sort((a, b) => b - a)) {
      const fila = filas.get(y)!.sort((a, b) => a.transform[4] - b.transform[4]);
      let texto = "";
      let fin = -Infinity;
      for (const p of fila) {
        const x = p.transform[4];
        texto += texto ? (x - fin > 12 ? " | " : x - fin > 1 ? " " : "") : "";
        texto += p.str.trim();
        fin = x + p.width;
      }
      renglones.push(texto);
    }
  }
  await pdf.destroy();
  return renglones;
}
