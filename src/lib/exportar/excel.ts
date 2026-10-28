// Exportación a Excel (10.6 y 10.8). Una hoja por tabla, encabezado con la marca y montos
// con formato de pesos. Los NSS y CURP nunca llegan aquí (los reportes no los incluyen).
import "server-only";
import ExcelJS from "exceljs";

export type Columna = { clave: string; titulo: string; tipo?: "texto" | "pesos" | "numero" | "fecha" | "porcentaje"; ancho?: number };
export type Hoja = { nombre: string; titulo: string; columnas: Columna[]; filas: Record<string, string | number | null>[]; totales?: Record<string, number> };

const FORMATO = { pesos: '"$"#,##0.00', numero: "#,##0.##", porcentaje: "0.0%", fecha: "yyyy-mm-dd", texto: "@" } as const;

export async function libroExcel(hojas: Hoja[]): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  libro.creator = "RPD Control";
  for (const h of hojas) {
    const ws = libro.addWorksheet(h.nombre.slice(0, 31));
    ws.addRow([h.titulo]).font = { bold: true, size: 13, color: { argb: "FF004AAD" } };
    ws.addRow([]);
    const enc = ws.addRow(h.columnas.map((c) => c.titulo));
    enc.font = { bold: true, color: { argb: "FFFFFFFF" } };
    enc.eachCell((celda) => { celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF004AAD" } }; });
    for (const f of h.filas) ws.addRow(h.columnas.map((c) => f[c.clave] ?? null));
    if (h.totales) {
      const t = ws.addRow(h.columnas.map((c, i) => (i === 0 ? "Total" : h.totales![c.clave] ?? null)));
      t.font = { bold: true };
    }
    h.columnas.forEach((c, i) => {
      const col = ws.getColumn(i + 1);
      col.width = c.ancho ?? Math.max(12, c.titulo.length + 2);
      if (c.tipo && c.tipo !== "texto") col.numFmt = FORMATO[c.tipo];
    });
    ws.views = [{ state: "frozen", ySplit: 3 }];
  }
  return Buffer.from(await libro.xlsx.writeBuffer());
}

export function respuestaExcel(buf: Buffer, nombre: string) {
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nombre}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
