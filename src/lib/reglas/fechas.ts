// Fechas del retiro (sección 7.1). Funciones puras: reciben fechas ISO "yyyy-MM-dd",
// `hoy` y los parámetros como argumentos; nunca leen el reloj ni la base.
// Se calcula en UTC sobre fechas sin hora, así la zona horaria no mueve ningún día.

export type FechaISO = string; // "2026-10-27"

const DIA_MS = 86_400_000;

function aDate(iso: FechaISO): Date {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d));
}

function aISO(d: Date): FechaISO {
  return d.toISOString().slice(0, 10);
}

export function sumarDias(iso: FechaISO, dias: number): FechaISO {
  return aISO(new Date(aDate(iso).getTime() + dias * DIA_MS));
}

export function diasEntre(desde: FechaISO, hasta: FechaISO): number {
  return Math.round((aDate(hasta).getTime() - aDate(desde).getTime()) / DIA_MS);
}

// Suma años de calendario. Un 29 de febrero cae en 28 de febrero si el año destino no es bisiesto.
export function sumarAnios(iso: FechaISO, anios: number): FechaISO {
  const [a, m, d] = iso.split("-").map(Number);
  const ultimoDia = new Date(Date.UTC(a + anios, m, 0)).getUTCDate();
  return aISO(new Date(Date.UTC(a + anios, m - 1, Math.min(d, ultimoDia))));
}

// Suma meses de calendario; el día se ajusta al último del mes si no existe (31-ene + 1 = 28/29-feb).
export function sumarMeses(iso: FechaISO, meses: number): FechaISO {
  const [a, m, d] = iso.split("-").map(Number);
  const total = a * 12 + (m - 1) + meses;
  const ano = Math.floor(total / 12), mes = total % 12;
  const ultimoDia = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
  return aISO(new Date(Date.UTC(ano, mes, Math.min(d, ultimoDia))));
}

export function esDiaHabil(iso: FechaISO, inhabiles: ReadonlySet<FechaISO>): boolean {
  const dia = aDate(iso).getUTCDay();
  return dia !== 0 && dia !== 6 && !inhabiles.has(iso);
}

// ───────────── 7.1 ─────────────

export type ParametrosFechas = {
  DIAS_ESPERA_DESEMPLEO: number;
  ANIOS_CANDADO_RETIRO: number;
  VIGENCIA_CONTRATO_DIAS: number;
};

/** Día en que el cliente ya puede retirar: baja + N días naturales (art. 191-II, criterio conservador). */
export function fechaElegibleDesempleo(fechaBaja: FechaISO, hoy: FechaISO, p: Pick<ParametrosFechas, "DIAS_ESPERA_DESEMPLEO">) {
  const fecha = sumarDias(fechaBaja, p.DIAS_ESPERA_DESEMPLEO);
  const diasFaltan = Math.max(0, diasEntre(hoy, fecha));
  return { fecha, diasFaltan, yaPuede: diasFaltan === 0 };
}

export type EstadoUltimoRetiro = "por_verificar" | "nunca_retiro" | "con_retiro";

export type Candado =
  | { estado: "por_verificar" }
  | { estado: "libre" }
  | { estado: "vigente"; fecha: FechaISO; diasFaltan: number }
  | { estado: "vencido"; fecha: FechaISO };

/** Candado de 5 años desde el último retiro. Sin verificar en el estado de cuenta de la Afore, bloquea. */
export function fechaFinCandado(
  estado: EstadoUltimoRetiro,
  fechaUltimoRetiro: FechaISO | null,
  hoy: FechaISO,
  p: Pick<ParametrosFechas, "ANIOS_CANDADO_RETIRO">,
): Candado {
  if (estado === "por_verificar") return { estado: "por_verificar" };
  if (estado === "nunca_retiro" || !fechaUltimoRetiro) return { estado: "libre" };
  const fecha = sumarAnios(fechaUltimoRetiro, p.ANIOS_CANDADO_RETIRO);
  const diasFaltan = diasEntre(hoy, fecha);
  return diasFaltan > 0 ? { estado: "vigente", fecha, diasFaltan } : { estado: "vencido", fecha };
}

/** Años completos de la cuenta Afore (modalidad A pide 3, B pide 5). */
export function antiguedadCuenta(fechaApertura: FechaISO, hoy: FechaISO): number {
  let anios = Number(hoy.slice(0, 4)) - Number(fechaApertura.slice(0, 4));
  if (sumarAnios(fechaApertura, anios) > hoy) anios -= 1;
  return Math.max(0, anios);
}

/** Fecha en que la cuenta cumple N años (para "no todavía"). */
export function fechaCumpleAnios(fechaApertura: FechaISO, anios: number): FechaISO {
  return sumarAnios(fechaApertura, anios);
}

/** Suma N días hábiles: salta sábado, domingo y los días inhábiles cargados. */
export function sumarDiasHabiles(fecha: FechaISO, n: number, inhabiles: ReadonlySet<FechaISO>): FechaISO {
  let actual = fecha;
  let contados = 0;
  while (contados < n) {
    actual = sumarDias(actual, 1);
    if (esDiaHabil(actual, inhabiles)) contados += 1;
  }
  return actual;
}

/** Días hábiles transcurridos después de `desde` hasta `hasta` inclusive (para "día 10 de 15"). */
export function diasHabilesTranscurridos(desde: FechaISO, hasta: FechaISO, inhabiles: ReadonlySet<FechaISO>): number {
  let n = 0;
  for (let d = sumarDias(desde, 1); d <= hasta; d = sumarDias(d, 1)) if (esDiaHabil(d, inhabiles)) n += 1;
  return n;
}

/** Vencimiento del contrato: firma + VIGENCIA_CONTRATO_DIAS naturales + días suspendidos por causa del cliente. */
export function vencimientoContrato(fechaContrato: FechaISO, diasSuspendidos: number, p: Pick<ParametrosFechas, "VIGENCIA_CONTRATO_DIAS">): FechaISO {
  return sumarDias(fechaContrato, p.VIGENCIA_CONTRATO_DIAS + diasSuspendidos);
}

/** Régimen por la fecha de primera alta (5.3): antes del 1-jul-1997 es Ley 73. */
export function regimenPorPrimeraAlta(fechaPrimeraAlta: FechaISO): "L73" | "L97" {
  return fechaPrimeraAlta < "1997-07-01" ? "L73" : "L97";
}

/** Bimestres completos entre la primera alta y la baja (petición de Irving, 28-oct).
 *  Es tiempo transcurrido, no cotizado: si hubo periodos sin empleo, sobrestima. */
export function bimestresEntre(alta: FechaISO, baja: FechaISO): number {
  if (baja <= alta) return 0;
  const [a1, m1, d1] = alta.split("-").map(Number);
  const [a2, m2, d2] = baja.split("-").map(Number);
  const meses = (a2 - a1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
  return Math.floor(Math.max(0, meses) / 2);
}

/** Bimestres que alcanzan las semanas cotizadas (un bimestre ≈ 61 días ≈ 8.7 semanas). */
export function bimestresPorSemanas(semanas: number): number {
  return Math.floor((semanas * 7) / 61);
}
