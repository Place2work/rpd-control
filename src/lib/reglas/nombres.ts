// Nombre de una persona: «Nombre(s)» no lleva apellidos. Si alguien escribió el nombre completo
// y además los apellidos, se quitan del final del nombre los que coinciden (sin importar
// acentos, mayúsculas ni el orden), para que no salga «RUBICEL SALGADO TERAN SALGADO TERAN».

const clave = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
const espacios = (t: string | null | undefined) => (t ?? "").replace(/\s+/g, " ").trim();

export type NombrePersona = { nombre: string; apellido_paterno: string | null; apellido_materno: string | null };

export function limpiarNombre(n: NombrePersona): NombrePersona {
  const paterno = espacios(n.apellido_paterno) || null;
  const materno = espacios(n.apellido_materno) || null;
  const palabras = espacios(n.nombre).split(" ").filter(Boolean);
  // Apellidos por quitar, palabra por palabra (un apellido puede ser compuesto: «DE LA CRUZ»).
  const pendientes = [...(paterno ? paterno.split(" ") : []), ...(materno ? materno.split(" ") : [])].map(clave);
  while (palabras.length > 1 && pendientes.length) {
    const i = pendientes.indexOf(clave(palabras[palabras.length - 1]));
    if (i < 0) break;
    pendientes.splice(i, 1);
    palabras.pop();
  }
  return { nombre: palabras.join(" "), apellido_paterno: paterno, apellido_materno: materno };
}
