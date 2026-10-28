// Arma la entrada del motor a partir del caso guardado y dice qué falta capturar.
import { antiguedadCuenta, type FechaISO } from "@/lib/reglas/fechas";
import type { EntradaPrecalificacion } from "@/lib/reglas/retiro";

// Versión de las reglas del motor: se guarda en cada cálculo (5.5).
export const VERSION_REGLAS = "2026.10-retiro-1";

type Num = { toString(): string } | null | undefined;
const n = (v: Num) => (v === null || v === undefined ? null : Number(v.toString()));
const iso = (d: Date | null | undefined): FechaISO | null => (d ? d.toISOString().slice(0, 10) : null);

export type CasoParaCalculo = {
  persona: { fecha_nacimiento: Date | null };
  datos_imss: {
    regimen: "L73" | "L97" | "por_definir"; fecha_baja: Date | null; semanas_totales: Num; bimestres_cotizados: number | null;
    sbc_ultimo: Num; sbc_promedio_250: Num; cotiza_actualmente: boolean;
  } | null;
  datos_afore: {
    fecha_apertura_cuenta: Date | null; saldo_rcv: Num; saldo_voluntarias: Num; estado_ultimo_retiro: "por_verificar" | "nunca_retiro" | "con_retiro";
    fecha_ultimo_retiro: Date | null; ide_vigente: boolean; tipo_cuenta: "registrada" | "asignada" | null;
  } | null;
};

/** Lo mínimo para calcular montos y semanas. Lo demás (IDE, cuenta) solo bloquea el resultado. */
export function faltantesParaCalcular(c: CasoParaCalculo): string[] {
  const f: string[] = [];
  const i = c.datos_imss;
  const a = c.datos_afore;
  if (n(i?.semanas_totales) === null) f.push("Semanas cotizadas (constancia de semanas)");
  if (n(i?.sbc_ultimo) === null && n(i?.sbc_promedio_250) === null) f.push("Último SBC o SBC promedio de 250 semanas");
  if (i?.bimestres_cotizados === null || i?.bimestres_cotizados === undefined) f.push("Bimestres cotizados (o primera alta y baja para calcularlos)");
  if (n(a?.saldo_rcv) === null) f.push("Saldo RCV (estado de cuenta Afore)");
  if (!a?.fecha_apertura_cuenta) f.push("Fecha de apertura de la cuenta Afore");
  return f;
}

export function entradaDesdeCaso(c: CasoParaCalculo, hoy: FechaISO, modalidadElegida: "A" | "B" | null): EntradaPrecalificacion {
  const i = c.datos_imss!;
  const a = c.datos_afore!;
  const apertura = iso(a.fecha_apertura_cuenta)!;
  return {
    hoy,
    regimen: i.regimen,
    fechaNacimiento: iso(c.persona.fecha_nacimiento),
    fechaBaja: iso(i.fecha_baja),
    cotizaActualmente: i.cotiza_actualmente,
    fechaAperturaCuenta: apertura,
    estadoUltimoRetiro: a.estado_ultimo_retiro,
    fechaUltimoRetiro: iso(a.fecha_ultimo_retiro),
    ideVigente: a.ide_vigente,
    tipoCuenta: a.tipo_cuenta,
    saldoVoluntarias: n(a.saldo_voluntarias) ?? 0,
    sbcUltimo: n(i.sbc_ultimo),
    sbcPromedio250: n(i.sbc_promedio_250),
    saldoRcv: n(a.saldo_rcv)!,
    bimestres: i.bimestres_cotizados ?? 0,
    antiguedadAnios: antiguedadCuenta(apertura, hoy),
    semanasTotales: n(i.semanas_totales)!,
    modalidadElegida,
  };
}
