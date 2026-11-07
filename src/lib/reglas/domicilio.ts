// Domicilio por partes (todas opcionales) → el texto que va en el contrato. Pura.

export type PartesDomicilio = {
  calle?: string | null; numeroExterior?: string | null; numeroInterior?: string | null;
  colonia?: string | null; codigoPostal?: string | null; municipio?: string | null; estado?: string | null;
};

const t = (x: string | null | undefined) => (x ?? "").replace(/\s+/g, " ").trim();

/** «Santa Elena 202, Int. 402 C, Col. Marbella, C.P. 76226, Querétaro, Querétaro». null si no hay ninguna parte. */
export function componerDomicilio(p: PartesDomicilio): string | null {
  const calle = [t(p.calle), t(p.numeroExterior)].filter(Boolean).join(" ");
  const partes = [
    calle,
    t(p.numeroInterior) && `Int. ${t(p.numeroInterior)}`,
    t(p.colonia) && (/^(col\.?|colonia|fracc|fraccionamiento|barrio|ejido|unidad|residencial)\b/i.test(t(p.colonia)) ? t(p.colonia) : `Col. ${t(p.colonia)}`),
    t(p.codigoPostal) && `C.P. ${t(p.codigoPostal)}`,
    t(p.municipio),
    t(p.estado),
  ].filter(Boolean);
  return partes.length ? partes.join(", ") : null;
}

// Primeros dos dígitos del código postal → estado (Correos de México). Solo sugiere: el usuario decide.
const RANGOS: [number, number, string][] = [
  [1, 16, "Ciudad de México"], [20, 20, "Aguascalientes"], [21, 22, "Baja California"], [23, 23, "Baja California Sur"],
  [24, 24, "Campeche"], [25, 27, "Coahuila de Zaragoza"], [28, 28, "Colima"], [29, 30, "Chiapas"], [31, 33, "Chihuahua"],
  [34, 35, "Durango"], [36, 38, "Guanajuato"], [39, 41, "Guerrero"], [42, 43, "Hidalgo"], [44, 49, "Jalisco"],
  [50, 57, "México"], [58, 61, "Michoacán de Ocampo"], [62, 62, "Morelos"], [63, 63, "Nayarit"], [64, 67, "Nuevo León"],
  [68, 71, "Oaxaca"], [72, 75, "Puebla"], [76, 76, "Querétaro"], [77, 77, "Quintana Roo"], [78, 79, "San Luis Potosí"],
  [80, 82, "Sinaloa"], [83, 85, "Sonora"], [86, 86, "Tabasco"], [87, 89, "Tamaulipas"], [90, 90, "Tlaxcala"],
  [91, 96, "Veracruz de Ignacio de la Llave"], [97, 97, "Yucatán"], [98, 99, "Zacatecas"],
];

/** Estado al que corresponde un código postal de 5 dígitos (nombre como en el catálogo del INEGI), o null. */
export function estadoPorCodigoPostal(cp: string): string | null {
  if (!/^\d{5}$/.test(cp)) return null;
  const n = Number(cp.slice(0, 2));
  return RANGOS.find(([a, b]) => n >= a && n <= b)?.[2] ?? null;
}
