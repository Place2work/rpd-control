// Motor del retiro por desempleo (secciones 7.2 a 7.5 y 7.7). Funciones puras.
// Dinero en centavos enteros mientras se calcula; se redondea a 2 decimales al final.
// Todo resultado es ESTIMADO hasta que la Afore paga (2.5).
import { antiguedadCuenta, fechaCumpleAnios, fechaElegibleDesempleo, fechaFinCandado, sumarDias, sumarAnios, type EstadoUltimoRetiro, type FechaISO } from "./fechas";

export type ParametrosRetiro = {
  UMA_MENSUAL: number;
  MODALIDAD_A_ANIOS: number;
  MODALIDAD_A_BIMESTRES: number;
  MODALIDAD_A_DIAS_SBC: number;
  MODALIDAD_A_TOPE_UMAS: number;
  MODALIDAD_B_ANIOS: number;
  MODALIDAD_B_DIAS_SBC: number;
  MODALIDAD_B_PCT_RCV: number;
  UMBRAL_DIFERENCIA_MODALIDAD: number;
  HONORARIO_RETIRO_PCT: number;
  IVA: number;
  L97_SEMANAS_2021: number;
  L97_INCREMENTO_ANUAL: number;
  L97_SEMANAS_TOPE: number;
  L73_SEMANAS_MINIMAS: number;
  L73_SEMANAS_CRITICAS: number;
  DIAS_ESPERA_DESEMPLEO: number;
  ANIOS_CANDADO_RETIRO: number;
};

const cent = (pesos: number) => Math.round(pesos * 100);
const pesos = (c: number) => Math.round(c) / 100;
const uno = (x: number) => Math.round(x * 10) / 10;

// ───────────── 2.2 Honorario: 30% IVA incluido ─────────────

/** Subtotal redondeado a 2 decimales; el IVA es la diferencia para que siempre sume exacto. */
export function desglosarHonorario(montoPagado: number, p: Pick<ParametrosRetiro, "HONORARIO_RETIRO_PCT" | "IVA">) {
  const total = Math.round(cent(montoPagado) * p.HONORARIO_RETIRO_PCT);
  const subtotal = Math.round(total / (1 + p.IVA));
  return { honorario: pesos(total), subtotal: pesos(subtotal), iva: pesos(total - subtotal) };
}

// ───────────── 7.2 y 7.3 Montos y semanas ─────────────

export type EntradaMontos = {
  sbcUltimo: number | null;
  sbcPromedio250: number | null;
  saldoRcv: number; // sin SAR 92
  bimestres: number;
  antiguedadAnios: number;
  semanasTotales: number;
};

export type OpcionModalidad = {
  modalidad: "A" | "B";
  monto: number;
  semanasPerdidas: number;
  semanasDespues: number;
  pctSaldo: number; // 0 a 100
  honorario: number;
  subtotal: number;
  iva: number;
  netoCliente: number;
  detalle: Record<string, number>;
};

/** Semanas que se pierden (art. 198 LSS): proporcionales al saldo retirado. */
export function semanasQueSePierden(monto: number, saldoRcv: number, semanasTotales: number) {
  if (saldoRcv <= 0 || semanasTotales <= 0) return { semanasPerdidas: 0, semanasDespues: semanasTotales, pctSaldo: 0 };
  const perdidas = (monto * semanasTotales) / saldoRcv; // = monto / (saldo / semanas)
  return {
    semanasPerdidas: uno(perdidas),
    semanasDespues: uno(semanasTotales - perdidas),
    pctSaldo: Math.round((monto / saldoRcv) * 10000) / 100,
  };
}

function opcion(modalidad: "A" | "B", montoCent: number, e: EntradaMontos, p: ParametrosRetiro, detalle: Record<string, number>): OpcionModalidad {
  const monto = pesos(Math.min(montoCent, cent(e.saldoRcv))); // 7.2.4: nunca más que el saldo
  const h = desglosarHonorario(monto, p);
  return { modalidad, monto, ...semanasQueSePierden(monto, e.saldoRcv, e.semanasTotales), ...h, netoCliente: pesos(cent(monto) - cent(h.honorario)), detalle };
}

export function calcularModalidades(e: EntradaMontos, p: ParametrosRetiro) {
  const opciones: OpcionModalidad[] = [];
  const califA = e.antiguedadAnios >= p.MODALIDAD_A_ANIOS && e.bimestres >= p.MODALIDAD_A_BIMESTRES && e.sbcUltimo !== null;
  const califB = e.antiguedadAnios >= p.MODALIDAD_B_ANIOS && e.sbcPromedio250 !== null;

  if (califA) {
    const porSbc = cent(e.sbcUltimo!) * p.MODALIDAD_A_DIAS_SBC;
    const tope = Math.round(cent(p.UMA_MENSUAL) * p.MODALIDAD_A_TOPE_UMAS);
    opciones.push(opcion("A", Math.min(porSbc, tope, cent(e.saldoRcv)), e, p, { dias_sbc: pesos(porSbc), tope_uma: pesos(tope), saldo: e.saldoRcv }));
  }
  if (califB) {
    const porSbc = cent(e.sbcPromedio250!) * p.MODALIDAD_B_DIAS_SBC;
    const porSaldo = Math.round(cent(e.saldoRcv) * p.MODALIDAD_B_PCT_RCV);
    opciones.push(opcion("B", Math.min(porSbc, porSaldo), e, p, { dias_sbc: pesos(porSbc), pct_saldo: pesos(porSaldo) }));
  }

  const elegible: "A" | "B" | "AB" | "ninguna" = califA && califB ? "AB" : califA ? "A" : califB ? "B" : "ninguna";
  // 7.2.3: por defecto la de mayor monto; se resalta la que cuesta menos semanas si la
  // diferencia de monto es menor al umbral.
  const porMonto = [...opciones].sort((a, b) => b.monto - a.monto);
  const porDefecto = porMonto[0]?.modalidad ?? null;
  let cuestaMenos: "A" | "B" | null = null;
  if (opciones.length === 2) {
    const [mayor, menor] = porMonto;
    const diferencia = mayor.monto > 0 ? (mayor.monto - menor.monto) / mayor.monto : 0;
    if (diferencia < p.UMBRAL_DIFERENCIA_MODALIDAD && menor.semanasPerdidas < mayor.semanasPerdidas) cuestaMenos = menor.modalidad;
  }
  return { opciones, elegible, porDefecto, cuestaMenos };
}

// ───────────── 7.4 Impacto en la pensión ─────────────

/** Mínimo de semanas Ley 97 del año en que cumple 60 (875 en 2026, +25 por año, tope 1,000). */
export function minimoLey97(anio: number, p: Pick<ParametrosRetiro, "L97_SEMANAS_2021" | "L97_INCREMENTO_ANUAL" | "L97_SEMANAS_TOPE">) {
  return Math.min(p.L97_SEMANAS_TOPE, p.L97_SEMANAS_2021 + p.L97_INCREMENTO_ANUAL * (anio - 2021));
}

/** Incrementos del art. 167 (Ley 73): años de 52 semanas arriba del mínimo, más la fracción. */
export function incrementosLey73(semanas: number, minimo: number) {
  const arriba = Math.max(0, semanas - minimo);
  const anios = Math.floor(arriba / 52);
  const sobrante = arriba - anios * 52;
  return anios + (sobrante > 26 ? 1 : sobrante >= 13 ? 0.5 : 0);
}

export type Impacto = {
  severidad: "ok" | "aviso" | "critica";
  mensajes: string[];
  minimoL97?: number;
  incrementosAntes?: number;
  incrementosDespues?: number;
  conservacionHasta?: FechaISO;
};

export function impactoEnPension(
  a: { regimen: "L73" | "L97" | "por_definir"; fechaNacimiento: FechaISO | null; hoy: FechaISO; semanasAntes: number; semanasDespues: number; fechaBaja: FechaISO | null },
  p: ParametrosRetiro,
): Impacto {
  const r: Impacto = { severidad: "ok", mensajes: [] };
  const subir = (s: "aviso" | "critica") => { if (s === "critica" || r.severidad === "ok") r.severidad = s; };
  const edad = a.fechaNacimiento ? antiguedadCuenta(a.fechaNacimiento, a.hoy) : null;

  if (a.regimen === "L97") {
    const anio60 = a.fechaNacimiento ? Number(sumarAnios(a.fechaNacimiento, 60).slice(0, 4)) : Number(a.hoy.slice(0, 4));
    const minimo = minimoLey97(anio60, p);
    r.minimoL97 = minimo;
    if (edad !== null && edad >= 55 && a.semanasDespues < minimo) {
      subir("critica");
      r.mensajes.push(`Quedaría con ${a.semanasDespues} semanas, debajo del mínimo de ${minimo} para pensionarse a los 60 (${anio60}).`);
    } else if (a.semanasDespues - minimo < 50) {
      subir("aviso");
      r.mensajes.push(`Quedaría a ${uno(a.semanasDespues - minimo)} semanas del mínimo Ley 97 de ${minimo} (${anio60}).`);
    }
  }

  if (a.regimen === "L73") {
    const antes = incrementosLey73(a.semanasAntes, p.L73_SEMANAS_MINIMAS);
    const despues = incrementosLey73(a.semanasDespues, p.L73_SEMANAS_MINIMAS);
    r.incrementosAntes = antes;
    r.incrementosDespues = despues;
    if (despues < antes) {
      subir("aviso");
      r.mensajes.push(`Pierde ${antes - despues} ${antes - despues === 1 ? "incremento" : "incrementos"} del art. 167 (de ${antes} a ${despues}).`);
    }
    if (a.semanasDespues < p.L73_SEMANAS_CRITICAS) {
      subir("critica");
      r.mensajes.push(`Quedaría con ${a.semanasDespues} semanas, menos de ${p.L73_SEMANAS_CRITICAS}: pone en riesgo la pensión Ley 73.`);
    }
    // Conservación de derechos: baja + máx(semanas/4 en semanas, 12 meses).
    if (a.fechaBaja) {
      const porSemanas = sumarDias(a.fechaBaja, Math.floor(a.semanasAntes / 4) * 7);
      const porAnio = sumarAnios(a.fechaBaja, 1);
      r.conservacionHasta = porSemanas > porAnio ? porSemanas : porAnio;
      if (a.fechaNacimiento && r.conservacionHasta < sumarAnios(a.fechaNacimiento, 60)) {
        subir("aviso");
        r.mensajes.push(`La conservación de derechos vence el ${r.conservacionHasta}, antes de cumplir 60; puede recuperarla con 52 semanas nuevas.`);
      }
    }
  }
  return r;
}

// ───────────── 7.5 Los 6 resultados ─────────────

export type Resultado = "NO_ELEGIBLE_DEFINITIVO" | "NO_ELEGIBLE_DESVIO" | "NO_TODAVIA" | "APTO_BLOQUEADO" | "CALIFICA_NO_CONVIENE" | "APTO";

export type EntradaPrecalificacion = EntradaMontos & {
  hoy: FechaISO;
  regimen: "L73" | "L97" | "por_definir";
  fechaNacimiento: FechaISO | null;
  fechaBaja: FechaISO | null;
  cotizaActualmente: boolean;
  fechaAperturaCuenta: FechaISO | null;
  estadoUltimoRetiro: EstadoUltimoRetiro;
  fechaUltimoRetiro: FechaISO | null;
  ideVigente: boolean;
  tipoCuenta: "registrada" | "asignada" | null;
  saldoVoluntarias: number;
  modalidadElegida?: "A" | "B" | null; // si el asesor escoge otra que la de por defecto
};

export type Precalificacion = {
  resultado: Resultado;
  motivos: string[];
  tareas: string[];
  fechaElegibilidad: FechaISO | null;
  servicioSugerido: string | null;
  modalidades: ReturnType<typeof calcularModalidades>;
  elegida: OpcionModalidad | null;
  impacto: Impacto | null;
  explicacion: string;
};

const mxn = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const fechaLarga = (iso: FechaISO) => new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
const semanasTxt = (n: number) => n.toLocaleString("es-MX", { maximumFractionDigits: 1 });

export function precalificar(e: EntradaPrecalificacion, p: ParametrosRetiro): Precalificacion {
  const modalidades = calcularModalidades(e, p);
  const motivos: string[] = [];
  const tareas: string[] = [];
  const base = { modalidades, tareas, motivos, servicioSugerido: null as string | null, fechaElegibilidad: null as FechaISO | null };
  const edad = e.fechaNacimiento ? antiguedadCuenta(e.fechaNacimiento, e.hoy) : null;

  // 1. Constancia en ceros.
  if (e.semanasTotales <= 0 && e.saldoRcv <= 0) {
    motivos.push("La constancia y el estado de cuenta están en ceros.");
    return cerrar({ ...base, resultado: "NO_ELEGIBLE_DEFINITIVO", motivos }, null, null, e);
  }

  // Fechas de "no todavía".
  const fechas: FechaISO[] = [];
  if (e.cotizaActualmente) motivos.push("Cotiza actualmente: el retiro por desempleo requiere estar sin empleo formal.");
  if (e.fechaBaja) {
    const d = fechaElegibleDesempleo(e.fechaBaja, e.hoy, p);
    if (!d.yaPuede) { fechas.push(d.fecha); motivos.push(`El día ${p.DIAS_ESPERA_DESEMPLEO} desde la baja llega el ${fechaLarga(d.fecha)}.`); }
  } else {
    tareas.push("Captura la fecha de baja para calcular el día 46.");
  }
  const candado = fechaFinCandado(e.estadoUltimoRetiro, e.fechaUltimoRetiro, e.hoy, p);
  if (candado.estado === "vigente") { fechas.push(candado.fecha); motivos.push(`Retiró hace menos de ${p.ANIOS_CANDADO_RETIRO} años; puede volver el ${fechaLarga(candado.fecha)}.`); }

  // 2. No califica hoy por antigüedad o bimestres: ¿desvío o "no todavía"?
  if (modalidades.elegible === "ninguna") {
    const desvio = e.regimen === "L73" && edad !== null && edad >= 55 ? "PENSION_L73"
      : e.saldoVoluntarias > 0 ? "RETIRO_VOLUNTARIAS" : null;
    if (desvio) {
      motivos.push(desvio === "PENSION_L73" ? "No califica al retiro, pero por Ley 73 y edad conviene la asesoría de pensión."
        : "No califica al retiro, pero tiene aportaciones voluntarias que puede recuperar.");
      return cerrar({ ...base, resultado: "NO_ELEGIBLE_DESVIO", servicioSugerido: desvio === "RETIRO_VOLUNTARIAS" ? null : desvio }, null, null, e);
    }
    if (e.fechaAperturaCuenta) {
      const meta = e.bimestres >= p.MODALIDAD_A_BIMESTRES ? p.MODALIDAD_A_ANIOS : p.MODALIDAD_B_ANIOS;
      const f = fechaCumpleAnios(e.fechaAperturaCuenta, meta);
      if (f > e.hoy) { fechas.push(f); motivos.push(`La cuenta cumple ${meta} años el ${fechaLarga(f)} (modalidad ${meta === p.MODALIDAD_A_ANIOS ? "A" : "B"}).`); }
    } else {
      tareas.push("Captura la fecha de apertura de la cuenta Afore.");
    }
    if (e.sbcUltimo === null && e.sbcPromedio250 === null) tareas.push("Captura el SBC de la constancia de semanas.");
  }

  // 3. No todavía.
  if (e.cotizaActualmente || fechas.length > 0 || modalidades.elegible === "ninguna") {
    const fecha = fechas.sort().at(-1) ?? null;
    return cerrar({ ...base, resultado: "NO_TODAVIA", fechaElegibilidad: fecha }, null, null, e);
  }

  // Modalidad: la que escoja el asesor si califica a ella; si no, la de por defecto.
  const elegida = modalidades.opciones.find((o) => o.modalidad === (e.modalidadElegida ?? modalidades.porDefecto)) ?? modalidades.opciones[0];
  const impacto = impactoEnPension({ regimen: e.regimen, fechaNacimiento: e.fechaNacimiento, hoy: e.hoy,
    semanasAntes: e.semanasTotales, semanasDespues: elegida.semanasDespues, fechaBaja: e.fechaBaja }, p);

  // 4. Apto, pero falta verificar algo.
  if (candado.estado === "por_verificar") tareas.push("Verificar el último retiro en el estado de cuenta Afore.");
  if (!e.ideVigente) tareas.push("Actualizar el IDE (biometría) en la Afore.");
  if (e.tipoCuenta === "asignada") tareas.push("Registrar la cuenta en la Afore (está asignada).");
  if (e.tipoCuenta === null) tareas.push("Confirmar que la cuenta está registrada, no asignada.");
  if (candado.estado === "por_verificar" || !e.ideVigente || e.tipoCuenta !== "registrada") {
    return cerrar({ ...base, resultado: "APTO_BLOQUEADO" }, elegida, impacto, e);
  }

  // 5. Califica pero no conviene.
  if (impacto.severidad === "critica") {
    motivos.push(...impacto.mensajes);
    return cerrar({ ...base, resultado: "CALIFICA_NO_CONVIENE", servicioSugerido: e.regimen === "L73" ? "PENSION_L73" : "PENSION_L97" }, elegida, impacto, e);
  }

  // 6. Apto.
  return cerrar({ ...base, resultado: "APTO" }, elegida, impacto, e);
}

function cerrar(
  r: Omit<Precalificacion, "elegida" | "impacto" | "explicacion">,
  elegida: OpcionModalidad | null,
  impacto: Impacto | null,
  e: EntradaPrecalificacion,
): Precalificacion {
  return { ...r, elegida, impacto, explicacion: explicar(r.resultado, elegida, r.fechaElegibilidad, e) };
}

// ───────────── 7.7 Texto para el cliente ─────────────

export function explicar(resultado: Resultado, o: OpcionModalidad | null, fecha: FechaISO | null, e: Pick<EntradaPrecalificacion, "semanasTotales">): string {
  if (o && (resultado === "APTO" || resultado === "APTO_BLOQUEADO" || resultado === "CALIFICA_NO_CONVIENE")) {
    const texto = `Puedes retirar hasta ${mxn(o.monto)} (estimado). A cambio, se descuentan ${semanasTxt(o.semanasPerdidas)} semanas de las ${semanasTxt(e.semanasTotales)} que tienes (quedarías con ${semanasTxt(o.semanasDespues)}). Nuestro honorario sería ${mxn(o.honorario)}, IVA incluido; recibirías alrededor de ${mxn(o.netoCliente)}.`;
    if (resultado === "CALIFICA_NO_CONVIENE") return `${texto} Sin embargo, perder esas semanas pone en riesgo tu pensión; te recomendamos revisarlo antes de retirar.`;
    if (resultado === "APTO_BLOQUEADO") return `${texto} Antes de ingresar hay que completar unos trámites con la Afore.`;
    return texto;
  }
  if (resultado === "NO_TODAVIA") {
    return fecha ? `Todavía no puedes retirar. Si todo sigue igual, podrías hacerlo a partir del ${fechaLarga(fecha)}. Te avisamos ese día.`
      : "Todavía no puedes retirar mientras sigas con empleo formal registrado en el IMSS.";
  }
  if (resultado === "NO_ELEGIBLE_DESVIO") return "El retiro por desempleo no es para ti en este momento, pero hay otra opción que te conviene más; te la explicamos.";
  return "Con la información de tu constancia y tu estado de cuenta, no es posible hacer el retiro por desempleo.";
}
