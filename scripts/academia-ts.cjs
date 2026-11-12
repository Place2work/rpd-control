// Genera src/lib/academia/contenido.ts desde content/academia/ (módulos .md, preguntas .json, rutas y acuses).
// Uso: npm run academia:contenido   (una prueba verifica que esté sincronizado)
const fs = require('node:fs');
const path = require('node:path');
const base = path.join(__dirname, '..', 'content', 'academia');
const leerJson = (f) => JSON.parse(fs.readFileSync(path.join(base, f), 'utf8'));
const rutas = leerJson('rutas.json');
const acuses = leerJson('acuses.json');
const evaluacion = leerJson('evaluacion.json');
const modulos = [];
for (const r of rutas) {
  const dir = path.join(base, r.clave);
  for (const archivo of fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort()) {
    const texto = fs.readFileSync(path.join(dir, archivo), 'utf8');
    const m = texto.match(/^---\n([\s\S]+?)\n---\n\n?([\s\S]*)$/);
    if (!m) throw new Error(`Falta el encabezado en ${archivo}`);
    modulos.push({ ...JSON.parse(m[1]), contenido: m[2] });
  }
}
const preguntas = rutas.flatMap((r) => leerJson(path.join('preguntas', `${r.clave}.json`)));
fs.writeFileSync(path.join(__dirname, '..', 'src', 'lib', 'academia', 'contenido.ts'),
`// GENERADO por scripts/academia-ts.cjs desde content/academia/. No editar a mano.
// Incluye las respuestas correctas: solo en el servidor.
import "server-only";
import type { Acuse, Modulo, Pregunta, ReglasEvaluacion, Ruta } from "./tipos";

export const EVALUACION: ReglasEvaluacion = ${JSON.stringify(evaluacion, null, 1)};

export const RUTAS: Ruta[] = ${JSON.stringify(rutas, null, 1)};

export const ACUSES: Acuse[] = ${JSON.stringify(acuses, null, 1)};

export const MODULOS: Modulo[] = ${JSON.stringify(modulos, null, 1)};

export const PREGUNTAS: Pregunta[] = ${JSON.stringify(preguntas, null, 1)};
`);
console.log(`ok: ${rutas.length} rutas, ${modulos.length} módulos, ${preguntas.length} preguntas`);
