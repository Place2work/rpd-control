import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Sesion } from "@/lib/auth/sesion";
import { conUsuario } from "@/lib/db/prisma";
import type { CasoDetalle } from "@/lib/prospectos/consultas";
import { antiguedadCuenta, regimenPorPrimeraAlta } from "@/lib/reglas/fechas";
import { enmascararClabe } from "@/lib/reglas/identificadores";
import { hoyCDMX } from "@/lib/tiempo";
import { guardarAfore, guardarDictamen, guardarImss } from "../acciones";
import { Campo, CampoTexto, Casilla, Dato, isoODefecto, numero, Seleccion } from "../campos";
import { FormularioAccion } from "../formulario-accion";

const REGIMENES = [["L73", "Ley 73"], ["L97", "Ley 97"], ["por_definir", "Por definir"]] as const;
const ESTADOS_RETIRO = [
  ["por_verificar", "Por verificar en el estado de cuenta"],
  ["nunca_retiro", "Verificado: nunca ha retirado"],
  ["con_retiro", "Verificado: tiene un retiro previo"],
] as const;
const ETIQUETAS = {
  fecha_primera_alta: "Primera alta", fecha_constancia: "Fecha de la constancia", fecha_baja: "Fecha de baja",
  semanas_cotizadas: "Semanas cotizadas", semanas_descontadas: "Semanas descontadas", semanas_reintegradas: "Semanas reintegradas",
  bimestres_cotizados: "Bimestres", sbc_ultimo: "Último SBC", sbc_promedio_250: "SBC promedio", regimen: "Régimen",
  fecha_apertura_cuenta: "Apertura de cuenta", fecha_estado_cuenta: "Estado de cuenta", fecha_ultimo_retiro: "Último retiro",
  saldo_rcv: "Saldo RCV", saldo_sar92: "SAR 92", saldo_vivienda: "Vivienda", saldo_voluntarias: "Voluntarias", clabe: "CLABE",
  dictamen_manual_motivo: "Motivo",
};
// Cuentas que a menudo no son nivel 4 (2.3): solo una advertencia.
const SOLO_DIGITALES = /\b(nu|nubank|mercado ?pago|spin|hey ?banco|klar|stori|ual[aá])\b/i;

export async function PestanaImss({ caso, sesion }: { caso: CasoDetalle; sesion: Sesion }) {
  const afores = await conUsuario(sesion.claims, (tx) => tx.afore.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }), sesion.ip);
  const i = caso.datos_imss;
  const a = caso.datos_afore;
  const hoy = hoyCDMX();
  const sugerido = i?.fecha_primera_alta ? regimenPorPrimeraAlta(isoODefecto(i.fecha_primera_alta)) : null;
  const antiguedad = a?.fecha_apertura_cuenta ? antiguedadCuenta(isoODefecto(a.fecha_apertura_cuenta), hoy) : null;
  const puedeDictaminar = sesion.usuario.rol === "director" || sesion.usuario.rol === "asesor";
  const avisoDigital = a?.banco && SOLO_DIGITALES.test(a.banco);

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>IMSS</CardTitle></CardHeader>
        <CardContent>
          <FormularioAccion accion={guardarImss.bind(null, caso.id)} etiquetas={ETIQUETAS}>
            <div className="grid gap-4 sm:grid-cols-2">
              <CampoTexto id="fecha_baja" etiqueta="Fecha de baja" tipo="date" max={hoy} valor={isoODefecto(i?.fecha_baja)} />
              <CampoTexto id="fecha_primera_alta" etiqueta="Primera alta en el IMSS" tipo="date" valor={isoODefecto(i?.fecha_primera_alta)} />
              <Seleccion id="regimen" etiqueta="Régimen" ayuda={sugerido ? `por la primera alta: ${sugerido}` : "«Por definir» lo calcula con la primera alta"}
                valor={i?.regimen ?? "por_definir"} opciones={REGIMENES} />
              <CampoTexto id="regimen_justificacion" etiqueta="Justificación" ayuda="solo si cambias el régimen sugerido" valor={i?.regimen_justificacion} />
              <CampoTexto id="fecha_constancia" etiqueta="Fecha de la constancia de semanas" tipo="date" max={hoy} valor={isoODefecto(i?.fecha_constancia)} />
              <CampoTexto id="bimestres_cotizados" etiqueta="Bimestres cotizados" inputMode="numeric" valor={i?.bimestres_cotizados} />
              <CampoTexto id="semanas_cotizadas" etiqueta="Semanas cotizadas" inputMode="decimal" valor={numero(i?.semanas_cotizadas)} />
              <CampoTexto id="semanas_descontadas" etiqueta="Semanas descontadas" inputMode="decimal" valor={numero(i?.semanas_descontadas)} />
              <CampoTexto id="semanas_reintegradas" etiqueta="Semanas reintegradas" inputMode="decimal" valor={numero(i?.semanas_reintegradas)} />
              <Campo id="semanas_totales" etiqueta="Semanas totales">
                <p className="cifra flex h-10 items-center text-ink">{i?.semanas_totales ? numero(i.semanas_totales) : "Se calcula al guardar"}</p>
              </Campo>
              <CampoTexto id="sbc_ultimo" etiqueta="Último SBC diario" ayuda="$" inputMode="decimal" valor={numero(i?.sbc_ultimo)} />
              <CampoTexto id="sbc_promedio_250" etiqueta="SBC promedio 250 semanas" ayuda="$" inputMode="decimal" valor={numero(i?.sbc_promedio_250)} />
              <CampoTexto id="ultimo_patron" etiqueta="Último patrón" className="sm:col-span-2" valor={i?.ultimo_patron} />
            </div>
            <Casilla id="cotiza_actualmente" etiqueta="Cotiza actualmente (tiene empleo con IMSS)" marcada={i?.cotiza_actualmente} />
            <p className="text-xs text-ink-muted">Cambios en SBC y semanas quedan resaltados en la bitácora con tu nombre.</p>
          </FormularioAccion>
        </CardContent>
      </Card>

      <div className="grid content-start gap-4">
        <Card>
          <CardHeader><CardTitle>Afore</CardTitle></CardHeader>
          <CardContent>
            <FormularioAccion accion={guardarAfore.bind(null, caso.id)} etiquetas={ETIQUETAS}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Seleccion id="afore" etiqueta="Afore" valor={a?.afore} vacia="Sin capturar" opciones={afores.map((x) => [x.clave, x.nombre] as const)} />
                <Seleccion id="tipo_cuenta" etiqueta="Tipo de cuenta" valor={a?.tipo_cuenta} vacia="Sin capturar"
                  opciones={[["registrada", "Registrada"], ["asignada", "Asignada (no puede retirar)"]]} />
                <CampoTexto id="fecha_apertura_cuenta" etiqueta="Apertura de la cuenta" tipo="date" max={hoy}
                  ayuda={antiguedad !== null ? `${antiguedad} ${antiguedad === 1 ? "año" : "años"}` : undefined} valor={isoODefecto(a?.fecha_apertura_cuenta)} />
                <CampoTexto id="fecha_estado_cuenta" etiqueta="Fecha del estado de cuenta" tipo="date" max={hoy} valor={isoODefecto(a?.fecha_estado_cuenta)} />
                <CampoTexto id="saldo_rcv" etiqueta="Saldo RCV" ayuda="sin SAR 92" inputMode="decimal" valor={numero(a?.saldo_rcv)} />
                <CampoTexto id="saldo_sar92" etiqueta="SAR 92" inputMode="decimal" valor={numero(a?.saldo_sar92)} />
                <CampoTexto id="saldo_vivienda" etiqueta="Vivienda" ayuda="informativo" inputMode="decimal" valor={numero(a?.saldo_vivienda)} />
                <CampoTexto id="saldo_voluntarias" etiqueta="Voluntarias" inputMode="decimal" valor={numero(a?.saldo_voluntarias)} />
                <Seleccion id="estado_ultimo_retiro" etiqueta="Último retiro por desempleo" valor={a?.estado_ultimo_retiro ?? "por_verificar"} opciones={ESTADOS_RETIRO} />
                <CampoTexto id="fecha_ultimo_retiro" etiqueta="Fecha del último retiro" ayuda="solo si tiene retiro previo" tipo="date" max={hoy}
                  valor={isoODefecto(a?.fecha_ultimo_retiro)} />
                <CampoTexto id="banco" etiqueta="Banco" valor={a?.banco} />
                {sesion.usuario.rol !== "vendedor" && (
                  <CampoTexto id="clabe" etiqueta="CLABE" inputMode="numeric" maxLength={18}
                    ayuda={a?.clabe_ultimos4 ? `actual ${enmascararClabe(a.clabe_ultimos4)}; escribe solo para reemplazarla` : "18 dígitos; se guarda cifrada"} />
                )}
              </div>
              {avisoDigital && (
                <p className="rounded-md bg-aviso-tint px-3 py-2 text-sm text-aviso">
                  Ojo: {a!.banco} suele ser cuenta solo digital y a veces no es nivel 4. Confírmalo antes de ingresar (2.3).
                </p>
              )}
              <div className="grid sm:grid-cols-2">
                <Casilla id="ide_vigente" etiqueta="IDE (biometría) vigente" marcada={a?.ide_vigente} />
                <Casilla id="cuenta_nivel4" etiqueta="Cuenta bancaria nivel 4" marcada={a?.cuenta_nivel4} />
                <Casilla id="cuenta_solo_digital" etiqueta="Cuenta solo digital" marcada={a?.cuenta_solo_digital} />
              </div>
              {a?.ultimo_retiro_verificado_at && (
                <p className="text-xs text-ink-muted">
                  Último retiro verificado el {new Intl.DateTimeFormat("es-MX", { dateStyle: "long", timeZone: "America/Mexico_City" }).format(a.ultimo_retiro_verificado_at)}.
                </p>
              )}
            </FormularioAccion>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Dictamen de elegibilidad</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <p className="text-sm text-ink-muted">
              Mientras llega la calculadora, el dictamen «Apto» habilita pasar a Precalificado y a Contrato. También sirve para casos que
              el motor no resuelve, como cuentas con menos de 3 años.
            </p>
            {caso.dictamen_manual && (
              <dl className="grid gap-2 rounded-md bg-brand-tint p-3 text-sm">
                <Dato titulo="Dictamen actual" valor={caso.dictamen_manual === "APTO" ? "Apto" : "No apto"} />
                <Dato titulo="Motivo" valor={caso.dictamen_manual_motivo} />
              </dl>
            )}
            {puedeDictaminar ? (
              <FormularioAccion accion={guardarDictamen.bind(null, caso.id)} etiquetas={ETIQUETAS} boton="Guardar dictamen">
                <Seleccion id="dictamen_manual" etiqueta="Dictamen" valor={caso.dictamen_manual} vacia="Sin dictamen"
                  opciones={[["APTO", "Apto"], ["NO_APTO", "No apto"]]} />
                <Campo id="dictamen_manual_motivo" etiqueta="Motivo" ayuda="mínimo 10 caracteres">
                  <textarea id="dictamen_manual_motivo" name="dictamen_manual_motivo" rows={3} defaultValue={caso.dictamen_manual_motivo ?? ""}
                    className="w-full rounded-[var(--radius-boton)] border border-borde bg-surface p-3 text-sm" />
                </Campo>
              </FormularioAccion>
            ) : (
              <p className="text-sm text-ink-muted">Solo un asesor o el Director pueden dictaminar.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
