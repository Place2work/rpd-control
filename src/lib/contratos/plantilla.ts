// Plantillas de contrato y aviso de privacidad. Función pura: recibe el texto de la plantilla y
// los datos; devuelve bloques listos para el PDF y la lista de variables que faltan.
//
// Sintaxis (una línea = un renglón del original; línea en blanco separa párrafos):
//   # Título · ## Subtítulo centrado · ### Encabezado de sección · #### Título de cláusula
//   a) … o • … (incisos con sangría) · I. … (apartados) · ☐ … (casillas) · [[firmas]] · [[salto]]
//   {{ruta.a.dato}} · {{#si dato}}…{{/si}} · {{#no dato}}…{{/no}} · {{#cada lista}}{{letra}}) {{.}}{{/cada}}
//   **negritas** dentro del texto.
export type Datos = { [k: string]: string | number | boolean | null | undefined | string[] | Datos | Datos[] };
export type Bloque =
  | { tipo: "titulo" | "subtitulo" | "seccion" | "clausula"; texto: string }
  | { tipo: "parrafo"; texto: string }
  | { tipo: "apartado"; texto: string }
  | { tipo: "inciso"; etiqueta: string; texto: string }
  | { tipo: "casilla"; texto: string }
  | { tipo: "firmas" }
  | { tipo: "salto" };

export const BLANCO = "________________";

function leer(datos: Datos, ruta: string): unknown {
  return ruta.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), datos);
}
const vacio = (v: unknown) => v === undefined || v === null || v === "" || v === false || (Array.isArray(v) && v.length === 0);

/** Sustituye condicionales, listas y variables. Lo que falte queda como línea para llenar a mano. */
export function llenar(cuerpo: string, datos: Datos): { texto: string; faltantes: string[] } {
  const faltantes = new Set<string>();
  let t = cuerpo.replace(/\r\n/g, "\n");
  // Condicionales (sin anidar del mismo tipo) y listas.
  t = t.replace(/\{\{#si ([\w.]+)\}\}([\s\S]*?)\{\{\/si\}\}/g, (_, r: string, d: string) => (vacio(leer(datos, r)) ? "" : d));
  t = t.replace(/\{\{#no ([\w.]+)\}\}([\s\S]*?)\{\{\/no\}\}/g, (_, r: string, d: string) => (vacio(leer(datos, r)) ? d : ""));
  t = t.replace(/\{\{#cada ([\w.]+)\}\}([\s\S]*?)\{\{\/cada\}\}/g, (_, r: string, d: string) => {
    const lista = leer(datos, r);
    if (!Array.isArray(lista) || !lista.length) { faltantes.add(r); return ""; }
    return lista.map((x, i) => d.replaceAll("{{.}}", String(x)).replaceAll("{{letra}}", String.fromCharCode(97 + i))).join("");
  });
  t = t.replace(/\{\{([\w.]+)\}\}/g, (_, r: string) => {
    const v = leer(datos, r);
    if (vacio(v) || typeof v === "object") { faltantes.add(r); return BLANCO; }
    return String(v);
  });
  return { texto: t, faltantes: [...faltantes] };
}

const INCISO = /^([a-z]|[ivx]{1,4})\)\s+(.*)$/;
const APARTADO = /^([IVX]{1,4})\.\s+(.*)$/;

/** Convierte el texto ya llenado en bloques. Renglones seguidos se unen en un párrafo. */
export function bloques(texto: string): Bloque[] {
  const r: Bloque[] = [];
  let actual: Bloque | null = null;
  const cerrar = () => { if (actual) r.push(actual); actual = null; };
  for (const crudo of texto.split("\n")) {
    const l = crudo.trim();
    if (!l) { cerrar(); continue; }
    const enc = /^(#{1,4})\s+(.*)$/.exec(l);
    if (enc) { cerrar(); r.push({ tipo: (["titulo", "subtitulo", "seccion", "clausula"] as const)[enc[1].length - 1], texto: enc[2] }); continue; }
    if (l === "[[firmas]]") { cerrar(); r.push({ tipo: "firmas" }); continue; }
    if (l === "[[salto]]") { cerrar(); r.push({ tipo: "salto" }); continue; }
    if (l.startsWith("☐")) { cerrar(); r.push({ tipo: "casilla", texto: l.replace(/^☐\s*/, "") }); continue; }
    if (l.startsWith("• ")) { cerrar(); actual = { tipo: "inciso", etiqueta: "•", texto: l.slice(2) }; continue; }
    const inc = INCISO.exec(l);
    if (inc) { cerrar(); actual = { tipo: "inciso", etiqueta: `${inc[1]})`, texto: inc[2] }; continue; }
    const ap = APARTADO.exec(l);
    if (ap) { cerrar(); r.push({ tipo: "apartado", texto: l }); continue; }
    if (actual && (actual.tipo === "parrafo" || actual.tipo === "inciso")) actual.texto += ` ${l}`;
    else { cerrar(); actual = { tipo: "parrafo", texto: l }; }
  }
  cerrar();
  return r;
}

/** Trozos de texto con **negritas**. */
export function negritas(texto: string): { texto: string; negrita: boolean }[] {
  return texto.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((p) => (p.startsWith("**") ? { texto: p.slice(2, -2), negrita: true } : { texto: p, negrita: false }));
}

// Variables que el sistema sabe llenar (src/lib/contratos/datos.ts). Una plantilla nueva solo puede usar estas.
export const VARIABLES = [
  "folio", "ciudad", "fecha_firma", "vigencia_dias", "regularizacion", "advertencias",
  "prestador.nombre", "prestador.nombre_comercial", "prestador.rfc", "prestador.regimen", "prestador.domicilio",
  "prestador.banco", "prestador.cuenta", "prestador.clabe",
  "cliente.nombre", "cliente.curp", "cliente.nss", "cliente.domicilio", "cliente.email", "cliente.identificacion", "cliente.parentesco",
  "honorario.pct", "precio.pago_unico", "precio.pct_recuperado",
  "beneficiaria", "beneficiaria.nombre", "beneficiaria.relacion", "beneficiaria.curp", "beneficiaria.domicilio", "beneficiaria.identificacion",
  "finado", "finado.nombre", "finado.curp", "finado.nss", "finado.fecha_defuncion", "finado.regimen", "finado.afore",
] as const;

/** Errores de una plantilla antes de guardarla: variables desconocidas, bloques sin cerrar, sin firmas. */
export function validarPlantilla(cuerpo: string): string[] {
  const e: string[] = [];
  const conocidas = new Set<string>(VARIABLES);
  for (const m of cuerpo.matchAll(/\{\{([#/]?)(si|no|cada)?\s*([\w.]*)\}\}/g)) {
    const [, marca, bloque, ruta] = m;
    if (marca === "/" ) continue;
    if (marca === "#" && !["si", "no", "cada"].includes(bloque ?? "")) { e.push(`Bloque desconocido: ${m[0]}`); continue; }
    if (!marca && (ruta === "." || ruta === "letra")) continue;
    const nombre = marca ? ruta : `${bloque ?? ""}${ruta}`;
    if (!conocidas.has(nombre)) e.push(`Variable desconocida: {{${nombre}}}`);
  }
  for (const b of ["si", "no", "cada"]) {
    const abre = (cuerpo.match(new RegExp(`\\{\\{#${b} `, "g")) ?? []).length;
    const cierra = (cuerpo.match(new RegExp(`\\{\\{/${b}\\}\\}`, "g")) ?? []).length;
    if (abre !== cierra) e.push(`Hay ${abre} {{#${b} …}} y ${cierra} {{/${b}}}: deben ser iguales`);
  }
  if (!cuerpo.includes("[[firmas]]")) e.push("Falta [[firmas]] (el lugar de las firmas)");
  if (!/^# /m.test(cuerpo)) e.push("Falta el título (un renglón que empiece con «# »)");
  return [...new Set(e)];
}
