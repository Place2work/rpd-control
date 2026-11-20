// Lectura de la INE (credencial para votar), 20-nov-2026. Pura: recibe lo que se leyó de la foto y lo limpia y revisa
// (CURP con su dígito verificador, fecha y sexo contra la CURP, código postal, vigencia). No lee archivos ni la base.
import { datosDeCurp, validarCurp } from "./identificadores";

export type IneCruda = {
  es_ine: boolean;
  nombre: string | null; apellido_paterno: string | null; apellido_materno: string | null;
  curp: string | null; fecha_nacimiento: string | null; sexo: string | null;
  calle: string | null; numero_exterior: string | null; numero_interior: string | null; colonia: string | null;
  codigo_postal: string | null; municipio: string | null; estado: string | null;
  vigencia: string | null;
};

export type LecturaIne = {
  nombre: string | null; apellidoPaterno: string | null; apellidoMaterno: string | null;
  curp: string | null; fechaNacimiento: string | null; sexo: "H" | "M" | null;
  calle: string | null; numeroExterior: string | null; numeroInterior: string | null; colonia: string | null;
  codigoPostal: string | null; municipio: string | null; estado: string | null;
  vigencia: number | null; vigente: boolean | null;
  avisos: string[];
};

const limpio = (v: string | null | undefined) => {
  const t = (v ?? "").replace(/\s+/g, " ").trim();
  return t && !/^(n\/?a|null|ninguno|sin dato|-+)$/i.test(t) ? t : null;
};
/** «PÉREZ LÓPEZ» → «Pérez López» (la INE viene en mayúsculas). */
export function nombrePropio(v: string | null): string | null {
  if (!v) return null;
  return v.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (_, sep: string, l: string) => sep + l.toUpperCase())
    .replace(/\b(De|Del|La|Las|Los|Y)\b/g, (m) => m.toLowerCase()).replace(/^(\p{Ll})/u, (l) => l.toUpperCase());
}

export function revisarIne(c: IneCruda, hoy: string): { lectura?: LecturaIne; error?: string } {
  if (!c.es_ine) return { error: "La imagen no parece una credencial para votar (INE). Revisa que sea el documento correcto o captura los datos a mano." };
  const avisos: string[] = [];
  let curp: string | null = null, deCurp: { fechaNacimiento: string; sexo: "H" | "M" | "X" } | null = null;
  const curpTexto = limpio(c.curp);
  if (curpTexto) {
    const v = validarCurp(curpTexto);
    if (v.valido) { curp = v.valor; deCurp = datosDeCurp(v.valor); }
    else avisos.push(`La CURP leída (${v.valor}) no es válida: ${v.error.toLowerCase()}. Revísala en la credencial.`);
  }
  let fecha = limpio(c.fecha_nacimiento);
  if (fecha && (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || fecha < "1900-01-01" || fecha > hoy)) fecha = null;
  if (deCurp && fecha && deCurp.fechaNacimiento !== fecha) avisos.push("La fecha de nacimiento no coincide con la de la CURP; se toma la de la CURP.");
  const fechaNacimiento = deCurp?.fechaNacimiento ?? fecha;
  const sexoLeido = /^(h|m)$/i.test(limpio(c.sexo) ?? "") ? (limpio(c.sexo)!.toUpperCase() as "H" | "M") : null;
  const sexo = deCurp && deCurp.sexo !== "X" ? deCurp.sexo : sexoLeido;
  let cp = (limpio(c.codigo_postal) ?? "").replace(/\D/g, "");
  if (cp && cp.length !== 5) { avisos.push("El código postal leído no tiene 5 dígitos; captúralo a mano."); cp = ""; }
  const anio = Number((limpio(c.vigencia) ?? "").match(/\d{4}/g)?.pop() ?? NaN);
  const vigencia = Number.isFinite(anio) && anio >= 2000 && anio <= 2100 ? anio : null;
  const vigente = vigencia === null ? null : vigencia >= Number(hoy.slice(0, 4));
  if (vigente === false) avisos.push(`La credencial venció en ${vigencia}: pide una vigente para el trámite.`);
  return { lectura: {
    nombre: nombrePropio(limpio(c.nombre)), apellidoPaterno: nombrePropio(limpio(c.apellido_paterno)), apellidoMaterno: nombrePropio(limpio(c.apellido_materno)),
    curp, fechaNacimiento, sexo,
    calle: nombrePropio(limpio(c.calle)), numeroExterior: limpio(c.numero_exterior), numeroInterior: limpio(c.numero_interior),
    colonia: nombrePropio(limpio(c.colonia)), codigoPostal: cp || null, municipio: nombrePropio(limpio(c.municipio)), estado: nombrePropio(limpio(c.estado)),
    vigencia, vigente, avisos,
  } };
}
