// Markdown de las lecciones a bloques (sin HTML: el render arma elementos de React, nada se inyecta).
// Soporta lo que usa content/academia: títulos, párrafos, listas, tablas, citas, código, separadores, y en
// línea **negritas**, *cursivas* y `código`. Marca los recuadros «Lo que dices» y «Lo que nunca dices».

export type Linea = { tipo: "texto" | "negrita" | "cursiva" | "codigo"; texto: string }[];
export type Bloque =
  | { tipo: "titulo"; nivel: number; texto: Linea }
  | { tipo: "parrafo"; texto: Linea }
  | { tipo: "lista"; ordenada: boolean; items: Linea[] }
  | { tipo: "tabla"; encabezado: Linea[]; filas: Linea[][] }
  | { tipo: "cita"; texto: Linea[] }
  | { tipo: "codigo"; texto: string }
  | { tipo: "separador" }
  | { tipo: "recuadro"; variante: "dices" | "nunca"; bloques: Bloque[] };

export function enLinea(texto: string): Linea {
  const partes: Linea = [];
  const re = /(\*\*([^*]+?)\*\*|`([^`]+?)`|\*([^*\s][^*]*?)\*)/g;
  let ultimo = 0;
  for (const m of texto.matchAll(re)) {
    if (m.index! > ultimo) partes.push({ tipo: "texto", texto: texto.slice(ultimo, m.index) });
    if (m[2] !== undefined) partes.push({ tipo: "negrita", texto: m[2] });
    else if (m[3] !== undefined) partes.push({ tipo: "codigo", texto: m[3] });
    else partes.push({ tipo: "cursiva", texto: m[4] });
    ultimo = m.index! + m[0].length;
  }
  if (ultimo < texto.length) partes.push({ tipo: "texto", texto: texto.slice(ultimo) });
  return partes;
}

const celdas = (l: string) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => enLinea(c.trim()));

export function bloquesMarkdown(md: string): Bloque[] {
  const lineas = md.replace(/\r\n/g, "\n").split("\n");
  const out: Bloque[] = [];
  let i = 0;
  while (i < lineas.length) {
    const l = lineas[i];
    if (!l.trim()) { i++; continue; }
    if (l.startsWith("```")) {
      const cuerpo: string[] = [];
      i++;
      while (i < lineas.length && !lineas[i].startsWith("```")) cuerpo.push(lineas[i++]);
      i++;
      out.push({ tipo: "codigo", texto: cuerpo.join("\n") });
      continue;
    }
    const t = l.match(/^(#{1,6})\s+(.*)$/);
    if (t) { out.push({ tipo: "titulo", nivel: t[1].length, texto: enLinea(t[2]) }); i++; continue; }
    if (/^-{3,}\s*$/.test(l)) { out.push({ tipo: "separador" }); i++; continue; }
    if (l.trim().startsWith("|")) {
      const filas: string[] = [];
      while (i < lineas.length && lineas[i].trim().startsWith("|")) filas.push(lineas[i++]);
      const sinSeparador = filas.filter((f) => !/^\|?\s*:?-{2,}/.test(f.trim().replace(/^\|/, "")));
      out.push({ tipo: "tabla", encabezado: celdas(sinSeparador[0]), filas: sinSeparador.slice(1).map(celdas) });
      continue;
    }
    if (l.startsWith(">")) {
      const texto: Linea[] = [];
      while (i < lineas.length && lineas[i].startsWith(">")) texto.push(enLinea(lineas[i++].replace(/^>\s?/, "")));
      out.push({ tipo: "cita", texto });
      continue;
    }
    const item = (s: string) => s.match(/^\s*(?:[-•]|\d+\.)\s+(.*)$/);
    if (item(l)) {
      const ordenada = /^\s*\d+\./.test(l);
      const items: string[] = [];
      while (i < lineas.length && lineas[i].trim()) {
        const m = item(lineas[i]);
        if (m) items.push(m[1]);
        else if (/^\s{2,}\S/.test(lineas[i]) && items.length) items[items.length - 1] += " " + lineas[i].trim();
        else break;
        i++;
      }
      out.push({ tipo: "lista", ordenada, items: items.map(enLinea) });
      continue;
    }
    const parrafo: string[] = [];
    while (i < lineas.length && lineas[i].trim() && !/^(#{1,6}\s|```|>|\||\s*(?:[-•]|\d+\.)\s|-{3,}\s*$)/.test(lineas[i])) parrafo.push(lineas[i++].trim());
    if (parrafo.length) out.push({ tipo: "parrafo", texto: enLinea(parrafo.join(" ")) });
    else i++;
  }
  return conRecuadros(out);
}

/** «Lo que dices» (azul) y «Lo que nunca dices» (rojo): el párrafo que empieza así, y la lista que le sigue. */
function conRecuadros(bloques: Bloque[]): Bloque[] {
  const out: Bloque[] = [];
  for (let i = 0; i < bloques.length; i++) {
    const b = bloques[i];
    const inicio = b.tipo === "parrafo" && b.texto[0]?.tipo === "negrita" ? b.texto[0].texto : "";
    const variante = /^Lo que nunca dices/i.test(inicio) ? "nunca" : /^Lo que dices/i.test(inicio) ? "dices" : null;
    if (!variante) { out.push(b); continue; }
    // El título del recuadro ya dice «Lo que dices»: se quita la etiqueta en negritas del párrafo.
    const resto = b.tipo === "parrafo" ? b.texto.slice(1).map((x, k) => (k === 0 && x.tipo === "texto" ? { ...x, texto: x.texto.replace(/^\s*:?\s*/, "") } : x)).filter((x) => x.texto) : [];
    const dentro: Bloque[] = resto.length ? [{ tipo: "parrafo", texto: resto }] : [];
    if (bloques[i + 1]?.tipo === "lista") dentro.push(bloques[++i]);
    out.push({ tipo: "recuadro", variante, bloques: dentro });
  }
  return out;
}
