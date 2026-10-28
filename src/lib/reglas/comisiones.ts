// Dinero y comisiones (secciones 2.2 y 9). Funciones puras: reciben la foto del caso, los
// esquemas vigentes, los parámetros y `hoy`, y devuelven el estado DESEADO de cada comisión.
// El servidor concilia ese estado con la tabla sin tocar las ya pagadas, así que recalcular
// es idempotente. Dinero en centavos mientras se calcula.
//
// Ciclo (9): estimada al firmar contrato → devengada cuando entra el dinero que la origina →
// pagada cuando Irving la liquida. Nunca se devenga sobre dinero que no ha entrado.
import { diasEntre, sumarDias, type FechaISO } from "./fechas";
import { desglosarHonorario } from "./retiro";

const cent = (pesos: number) => Math.round(pesos * 100);
const pesos = (c: number) => Math.round(c) / 100;
const mxn = (n: number) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export type ParametrosDinero = {
  HONORARIO_RETIRO_PCT: number;
  IVA: number;
  BASE_HONORARIO: "neto" | "bruto"; // decisión 14.3: neto
  BASE_COMISION_VENDEDOR: "igual_honorario" | "neto" | "bruto";
  BASE_REPARTO_SOCIO: "subtotal" | "total"; // decisión 14.3: subtotal
  COSTO_ADMIN_SOCIO_POR: "caso" | "cobro";
  FALLEC_COMISION_INICIAL: number;
  FALLEC_COMISION_MENSUALIDAD: number;
  FALLEC_COMISION_PCT_RECUPERADO: number;
};

// ───────────── 2.2 Honorario sobre cada pago de la Afore ─────────────

export type PagoAforeFoto = { id: string; numero: number; fecha: FechaISO; bruto: number; isr: number; neto: number };

export function baseDePago(pago: Pick<PagoAforeFoto, "bruto" | "neto">, cual: "neto" | "bruto"): number {
  return cual === "bruto" ? pago.bruto : pago.neto;
}

/** Honorario (HONORARIO_RETIRO_PCT) sobre el depósito (neto o bruto según el parámetro), con su desglose. */
export function honorarioDePago(pago: Pick<PagoAforeFoto, "bruto" | "neto">, p: Pick<ParametrosDinero, "HONORARIO_RETIRO_PCT" | "IVA" | "BASE_HONORARIO">) {
  const base = baseDePago(pago, p.BASE_HONORARIO);
  return { base, ...desglosarHonorario(base, p) };
}

/** Desglose de un honorario fijo (pensiones y otros servicios): el total ya trae IVA. */
export function desglosarTotal(total: number, iva: number) {
  const t = cent(total);
  const subtotal = Math.round(t / (1 + iva));
  return { honorario: pesos(t), subtotal: pesos(subtotal), iva: pesos(t - subtotal) };
}

// ───────────── 9.1 Esquemas ─────────────

export type Escalon = { desde: number; hasta: number | null; monto: number };
export type ReglaEsquema =
  | { tipo: "porcentaje"; pct: number; base?: "monto_afore"; devenga?: string }
  | { tipo: "escalonado_mensual"; escalones: Escalon[]; cuenta?: "honorario_cobrado" }
  | { tipo: "reparto"; pct_socio: number; costo_admin: number; base_param?: string }
  | { tipo: "compuesto"; componentes: { clave: string; fijo_param?: string; pct_param?: string; pct?: number }[] };

export type Esquema = { id: string; reglas: ReglaEsquema };

/** Monto por referido según cuántos referidos cobrados sumó en el mes. Se aplica a TODOS (9.1). */
export function montoPorReferido(escalones: Escalon[], cuantos: number): number {
  const e = escalones.find((x) => cuantos >= x.desde && (x.hasta === null || cuantos <= x.hasta));
  return e?.monto ?? 0;
}

/** Lo que cobra un referidor en un mes con `cuantos` referidos cobrados (T12). */
export function liquidacionReferidor(escalones: Escalon[], cuantos: number): number {
  return pesos(cent(montoPorReferido(escalones, cuantos)) * cuantos);
}

/** Reparto del socio (9.1): (base − costo administrativo) × % socio. Nunca negativo (T13). */
export function repartoSocio(base: number, costoAdmin: number, pctSocio: number) {
  const neto = Math.max(0, cent(base) - cent(costoAdmin));
  const socio = Math.round(neto * pctSocio);
  return { base: pesos(neto), socio: pesos(socio), rpd: pesos(neto - socio) };
}

// ───────────── Comisiones de un caso ─────────────

export type CobroFoto = {
  id: string;
  pagoAforeId: string | null;
  concepto: string | null; // fallecimiento: pago_inicial | recuperado | primera_mensualidad
  base: number | null; // monto sobre el que se calculó (lo recuperado, en fallecimiento)
  honorario: number;
  subtotal: number;
  iva: number;
  estado: "por_cobrar" | "cobrado" | "cancelado";
  fecha: FechaISO | null; // fecha de cobro
};

export type CasoDinero = {
  id: string;
  tipoServicio: string;
  contratoFirmado: boolean;
  perdido: boolean;
  montoEstimado: number | null; // del último cálculo (retiro)
  vendedorId: string | null;
  referidorId: string | null;
  socio: { id: string; pct: number; costoAdmin: number } | null;
  pagos: PagoAforeFoto[];
  cobros: CobroFoto[];
};

export type EsquemasCaso = { vendedor: Esquema | null; referidor: Esquema | null; socio: Esquema | null };

export type ComisionDeseada = {
  clave: string; // identifica la comisión dentro del caso, para conciliar
  tipo: "vendedor" | "referido" | "socio";
  esquemaId: string;
  beneficiarioTipo: "usuario" | "referidor" | "socio";
  beneficiarioId: string;
  pagoAforeId: string | null;
  cobroId: string | null;
  componente: string | null;
  base: number;
  regla: string;
  monto: number;
  estado: "estimada" | "devengada";
  fechaDevengo: FechaISO | null;
  periodo: FechaISO | null; // primer día del mes (referidos)
};

const mesDe = (f: FechaISO) => f.slice(0, 7);
export function finDeMes(mes: string): FechaISO {
  const [a, m] = mes.split("-").map(Number);
  const siguiente = m === 12 ? `${a + 1}-01-01` : `${a}-${String(m + 1).padStart(2, "0")}-01`;
  return sumarDias(siguiente, -1);
}

/**
 * Estado deseado de las comisiones del caso. `referidosPorMes` es cuántos referidos del
 * mismo referidor tuvieron su primer honorario cobrado en cada mes ("2026-10" → 4).
 */
export function comisionesDelCaso(
  c: CasoDinero,
  esquemas: EsquemasCaso,
  p: ParametrosDinero,
  hoy: FechaISO,
  referidosPorMes: Record<string, number> = {},
): ComisionDeseada[] {
  const r: ComisionDeseada[] = [];
  const vivos = c.cobros.filter((x) => x.estado !== "cancelado");
  const cobrados = vivos.filter((x) => x.estado === "cobrado" && x.fecha);
  // Las estimadas nacen con el contrato; si el caso se perdió, solo queda lo ya devengado.
  const estima = c.contratoFirmado && !c.perdido;
  const retiro = c.tipoServicio === "RETIRO_DESEMPLEO";
  const base = { pagoAforeId: null, cobroId: null, componente: null, fechaDevengo: null, periodo: null };

  // Vendedor.
  const ev = esquemas.vendedor;
  if (c.vendedorId && ev) {
    const benef = { tipo: "vendedor" as const, esquemaId: ev.id, beneficiarioTipo: "usuario" as const, beneficiarioId: c.vendedorId };
    if (retiro && ev.reglas.tipo === "porcentaje") {
      const pct = ev.reglas.pct;
      const cual = p.BASE_COMISION_VENDEDOR === "igual_honorario" ? p.BASE_HONORARIO : p.BASE_COMISION_VENDEDOR;
      const pctTxt = `${+(pct * 100).toFixed(2)}%`;
      if (c.pagos.length === 0 && estima && c.montoEstimado) {
        r.push({ ...base, ...benef, clave: "vendedor:estimado", base: c.montoEstimado, monto: pesos(cent(c.montoEstimado) * pct),
          regla: `${pctTxt} de ${mxn(c.montoEstimado)} (estimado del cálculo)`, estado: "estimada" });
      }
      // Modalidad B: una comisión por mensualidad, igual que el honorario (9.1).
      for (const pago of c.pagos) {
        const cobro = vivos.find((x) => x.pagoAforeId === pago.id);
        const devengada = cobro?.estado === "cobrado" && cobro.fecha;
        if (!devengada && c.perdido) continue;
        const b = baseDePago(pago, cual);
        r.push({ ...base, ...benef, clave: `vendedor:pago:${pago.numero}`, pagoAforeId: pago.id, cobroId: cobro?.id ?? null,
          base: b, monto: pesos(cent(b) * pct), regla: `${pctTxt} del pago ${pago.numero} de la Afore (${mxn(b)}, ${cual})`,
          estado: devengada ? "devengada" : "estimada", fechaDevengo: devengada ? cobro!.fecha : null });
      }
    }
    if (c.tipoServicio === "FALLECIMIENTO" && ev.reglas.tipo === "compuesto") {
      // Cada componente se devenga cuando entra su dinero; sin estimadas (montos inciertos).
      const fijo = (param?: string) => (param ? Number(p[param as keyof ParametrosDinero]) : 0);
      const usados = new Set<string>();
      for (const cobro of [...cobrados].sort((a, b) => (a.fecha! < b.fecha! ? -1 : 1))) {
        const comp = ev.reglas.componentes.find((x) => x.clave === cobro.concepto);
        if (!comp) continue;
        if (comp.fijo_param) {
          if (usados.has(comp.clave)) continue; // pago inicial y primera mensualidad, una sola vez
          usados.add(comp.clave);
          const m = fijo(comp.fijo_param);
          r.push({ ...base, ...benef, clave: `vendedor:${comp.clave}`, cobroId: cobro.id, componente: comp.clave, base: m, monto: m,
            regla: `${mxn(m)} fijos por ${comp.clave.replace("_", " ")}`, estado: "devengada", fechaDevengo: cobro.fecha });
        } else {
          const pct = comp.pct ?? fijo(comp.pct_param);
          const b = cobro.base ?? 0;
          r.push({ ...base, ...benef, clave: `vendedor:${comp.clave}:${cobro.id}`, cobroId: cobro.id, componente: comp.clave, base: b,
            monto: pesos(cent(b) * pct), regla: `${+(pct * 100).toFixed(2)}% de lo recuperado (${mxn(b)})`, estado: "devengada", fechaDevengo: cobro.fecha });
        }
      }
    }
    // Pensión, M40 e Infonavit: sin comisión hasta definir (decisión 14.3).
  }

  // Socio licenciatario (retiro): (honorario − costo administrativo) × 40%.
  const es = esquemas.socio;
  if (retiro && c.socio && es && es.reglas.tipo === "reparto") {
    const benef = { tipo: "socio" as const, esquemaId: es.id, beneficiarioTipo: "socio" as const, beneficiarioId: c.socio.id };
    const { pct, costoAdmin } = c.socio;
    const pctTxt = `${+(pct * 100).toFixed(2)}%`;
    const baseDe = (x: { honorario: number; subtotal: number }) => (p.BASE_REPARTO_SOCIO === "total" ? x.honorario : x.subtotal);
    const txtBase = p.BASE_REPARTO_SOCIO === "total" ? "honorario con IVA" : "subtotal sin IVA";
    if (vivos.length === 0 && estima && c.montoEstimado) {
      const h = desglosarHonorario(c.montoEstimado, p);
      const s = repartoSocio(baseDe(h), costoAdmin, pct);
      r.push({ ...base, ...benef, clave: "socio:estimado", base: baseDe(h), monto: s.socio, estado: "estimada",
        regla: `${pctTxt} de (${txtBase} ${mxn(baseDe(h))} − ${mxn(costoAdmin)}) (estimado)` });
    }
    // El costo administrativo se descuenta una vez por caso (o en cada cobro, según parámetro).
    let adminRestante = cent(costoAdmin);
    const orden = [...vivos].sort((a, b) => (a.fecha ?? "9999") < (b.fecha ?? "9999") ? -1 : (a.fecha ?? "9999") > (b.fecha ?? "9999") ? 1 : a.id < b.id ? -1 : 1);
    for (const cobro of orden) {
      const devengada = cobro.estado === "cobrado" && cobro.fecha;
      const b = baseDe(cobro);
      const admin = p.COSTO_ADMIN_SOCIO_POR === "cobro" ? cent(costoAdmin) : Math.min(adminRestante, cent(b));
      adminRestante -= p.COSTO_ADMIN_SOCIO_POR === "cobro" ? 0 : admin;
      if (!devengada && c.perdido) continue;
      const s = repartoSocio(b, pesos(admin), pct);
      r.push({ ...base, ...benef, clave: `socio:cobro:${cobro.id}`, cobroId: cobro.id, pagoAforeId: cobro.pagoAforeId, base: b, monto: s.socio,
        regla: `${pctTxt} de (${txtBase} ${mxn(b)} − ${mxn(pesos(admin))})`, estado: devengada ? "devengada" : "estimada", fechaDevengo: devengada ? cobro.fecha : null });
    }
  }

  // Referidor: una por caso; el escalón se fija con los referidos cobrados del mes (9.1).
  const er = esquemas.referidor;
  if (c.referidorId && er && er.reglas.tipo === "escalonado_mensual") {
    const benef = { tipo: "referido" as const, esquemaId: er.id, beneficiarioTipo: "referidor" as const, beneficiarioId: c.referidorId };
    const primero = cobrados.map((x) => x.fecha!).sort()[0];
    if (primero) {
      const mes = mesDe(primero);
      const n = Math.max(1, referidosPorMes[mes] ?? 1);
      const monto = montoPorReferido(er.reglas.escalones, n);
      const cerrado = mes < mesDe(hoy);
      r.push({ ...base, ...benef, clave: "referido", base: monto, monto, periodo: `${mes}-01`,
        regla: `${n} ${n === 1 ? "referido cobrado" : "referidos cobrados"} en ${mes}: ${mxn(monto)} c/u${cerrado ? "" : " (el mes sigue abierto)"}`,
        estado: cerrado ? "devengada" : "estimada", fechaDevengo: cerrado ? finDeMes(mes) : null });
    } else if (estima) {
      const monto = montoPorReferido(er.reglas.escalones, 1);
      r.push({ ...base, ...benef, clave: "referido", base: monto, monto, estado: "estimada",
        regla: `${mxn(monto)} por referido (estimado; el escalón se fija al cierre del mes de cobro)` });
    }
  }
  return r;
}

// ───────────── Conciliación con lo guardado ─────────────

export type ComisionGuardada = { id: string; clave: string | null; estado: "estimada" | "devengada" | "pagada" | "cancelada"; monto: number; base: number; regla: string; fechaDevengo: FechaISO | null; beneficiarioId: string };

export type Cambios = {
  crear: ComisionDeseada[];
  actualizar: { id: string; deseada: ComisionDeseada }[];
  cancelar: string[];
};

/** Qué crear, actualizar y cancelar. Las pagadas no se tocan nunca; las canceladas tampoco. */
export function conciliar(deseadas: ComisionDeseada[], guardadas: ComisionGuardada[]): Cambios {
  const vivas = new Map(guardadas.filter((g) => g.clave && g.estado !== "cancelada").map((g) => [g.clave!, g]));
  const cambios: Cambios = { crear: [], actualizar: [], cancelar: [] };
  for (const d of deseadas) {
    const g = vivas.get(d.clave);
    vivas.delete(d.clave);
    if (!g) { cambios.crear.push(d); continue; }
    if (g.estado === "pagada") continue;
    if (g.estado !== d.estado || g.monto !== d.monto || g.base !== d.base || g.regla !== d.regla || g.fechaDevengo !== d.fechaDevengo || g.beneficiarioId !== d.beneficiarioId) {
      cambios.actualizar.push({ id: g.id, deseada: d });
    }
  }
  for (const g of vivas.values()) if (g.estado !== "pagada") cambios.cancelar.push(g.id);
  return cambios;
}

// ───────────── 9.3 Margen por caso ─────────────

/** Honorario − IVA − comisiones = margen (9.2). Solo cuenta cobros cobrados y comisiones no canceladas. */
export function margenCaso(cobros: Pick<CobroFoto, "honorario" | "iva" | "estado">[], comisiones: { monto: number; estado: string }[]) {
  const ok = cobros.filter((x) => x.estado === "cobrado");
  const honorario = ok.reduce((a, x) => a + cent(x.honorario), 0);
  const iva = ok.reduce((a, x) => a + cent(x.iva), 0);
  const com = comisiones.filter((x) => x.estado !== "cancelada").reduce((a, x) => a + cent(x.monto), 0);
  return { honorario: pesos(honorario), iva: pesos(iva), comisiones: pesos(com), margen: pesos(honorario - iva - com) };
}

/** Suma al centavo (14.2: el estado de cuenta cuadra con la suma de sus casos). */
export function sumar(montos: number[]): number {
  return pesos(montos.reduce((a, m) => a + cent(m), 0));
}

// ───────────── 8.1 Alertas de dinero ─────────────

export type CasoConPagos = {
  id: string; folio: string; nombre: string; etapa: string; modalidad: "A" | "B" | null;
  pagos: { id: string; numero: number; fecha: FechaISO; cobrado: boolean; tieneCobro: boolean }[];
};
export type ComisionPorPagar = { id: string; beneficiario: string; beneficiarioClave: string; monto: number; fechaDevengo: FechaISO };
export type AlertaDinero = {
  regla: string; casoId: string | null; severidad: "aviso" | "critica"; mensaje: string; clave: string;
  para: ("asesor" | "director")[];
};

export function alertasDinero(casos: CasoConPagos[], comisiones: ComisionPorPagar[], hoy: FechaISO): AlertaDinero[] {
  const r: AlertaDinero[] = [];
  for (const c of casos) {
    if (c.etapa === "PERDIDO") continue;
    // Pago de Afore registrado sin cobro en 2 días.
    for (const p of c.pagos) {
      if (!p.cobrado && diasEntre(p.fecha, hoy) >= 2) {
        r.push({ regla: "HONORARIO_POR_COBRAR", casoId: c.id, severidad: "critica", para: ["asesor", "director"], clave: `HONORARIO_POR_COBRAR:${p.id}`,
          mensaje: `${c.nombre} (${c.folio}): el pago ${p.numero} de la Afore lleva ${diasEntre(p.fecha, hoy)} días sin cobro del honorario` });
      }
    }
    // Modalidad B: la siguiente mensualidad no se registró a los 35 días de la anterior.
    const ultimo = [...c.pagos].sort((a, b) => b.numero - a.numero)[0];
    if (c.modalidad === "B" && ultimo && ultimo.numero < 6 && diasEntre(ultimo.fecha, hoy) >= 35) {
      r.push({ regla: "PAGO_AFORE_PENDIENTE", casoId: c.id, severidad: "aviso", para: ["asesor"], clave: `PAGO_AFORE_PENDIENTE:${ultimo.id}`,
        mensaje: `${c.nombre} (${c.folio}): van ${diasEntre(ultimo.fecha, hoy)} días sin registrar la mensualidad ${ultimo.numero + 1}` });
    }
  }
  // Comisiones devengadas con más de 7 días sin pagar, agrupadas por beneficiario.
  const porBenef = new Map<string, ComisionPorPagar[]>();
  for (const k of comisiones) if (diasEntre(k.fechaDevengo, hoy) > 7) porBenef.set(k.beneficiarioClave, [...(porBenef.get(k.beneficiarioClave) ?? []), k]);
  for (const [clave, lista] of porBenef) {
    const antigua = lista.map((x) => x.fechaDevengo).sort()[0];
    r.push({ regla: "COMISION_POR_PAGAR", casoId: null, severidad: "aviso", para: ["director"], clave: `COMISION_POR_PAGAR:${clave}:${antigua}`,
      mensaje: `${lista[0].beneficiario}: ${lista.length} ${lista.length === 1 ? "comisión devengada" : "comisiones devengadas"} por ${mxn(sumar(lista.map((x) => x.monto)))} sin pagar desde el ${antigua}` });
  }
  return r;
}
