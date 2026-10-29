# Registro de decisiones

| Fecha | Decisión | Quién | Dónde quedó |
| --- | --- | --- | --- |
| 2026-10-27 | Se aprueba la estructura de carpetas y el esquema de datos de la fase 0 | Irving | `prisma/schema.prisma` |
| 2026-10-27 | Búsqueda de CURP/NSS con cifrado + índice ciego (HMAC) y **ligas oficiales de consulta** (RENAPO, IMSS NSS, IMSS semanas), editables como parámetros `LIGA_CONSULTA_*` | Irving | `lib/cripto`, `lib/reglas/identificadores.ts`, `components/rpd/ligas-consulta.tsx` |
| 2026-10-27 | Cuenta con menos de 3 años: el motor da `NO_TODAVIA` con la fecha en que cumple 3 años, y el asesor o el Director pueden **dictaminar manualmente** APTO / NO_APTO con motivo (mín. 10 caracteres). El dictamen prevalece y queda en bitácora | Irving | `casos.dictamen_manual*`, trigger `tg_dictamen_manual` |
| 2026-10-27 | Último retiro con tres estados: `por_verificar`, `nunca_retiro`, `con_retiro` (este exige fecha). Se guarda quién verificó y cuándo | Irving | `datos_afore.estado_ultimo_retiro`, trigger `tg_ultimo_retiro` |
| 2026-10-27 | Tareas programadas en **horario de CDMX** (07:00 alertas, 07:15 correo), no en UTC fijo | Irving | `app.tareas_pendientes_hoy()`, parámetros `HORA_*_CDMX` |
| 2026-10-27 | **Next.js 16** (16.4.3) en lugar de 15, a criterio del desarrollo. Prisma 7.10 | Irving → Claude | `package.json` |
| 2026-10-28 | Mientras no exista la calculadora (fase 2), el **dictamen manual «Apto»** habilita pasar a Precalificado y a Contrato | Irving | `lib/reglas/etapas.ts` |
| 2026-10-28 | **Bimestres cotizados**: si no se capturan, se calculan con la primera alta y la baja (bimestres completos). Aviso si las semanas cotizadas alcanzan menos bimestres (tiempo transcurrido ≠ cotizado) | Irving | `bimestresEntre()` en `lib/reglas/fechas.ts` |
| 2026-10-27 | Se mantiene Prisma; RLS se aplica con `conUsuario()` (transacción con claims + rol `authenticated`) | Claude (recomendación aprobada) | `lib/db/prisma.ts` |

## Pendientes de la sección 14.3 (con su valor por defecto ya cargado)

Base del 30% = depósito neto · base del 5% = la misma del honorario · reparto del socio sobre subtotal ·
escalón de referidos 3 a 10 con honorario cobrado · sin comisión en pensiones · una sola serie `RP-` ·
día 46 = baja + 46 · Vercel + Supabase · retención 5 años · logotipo SVG pendiente.

## Infraestructura (27-oct-2026)

| Pieza | Valor |
| --- | --- |
| Supabase | Proyecto **RPD Control** (`mltmnsykoemwplsawsau`, us-east-1), organización Ganadineroconduciendo.com, plan Free |
| Migraciones aplicadas | 000 base · 100 init · 200 seguridad · 300 bitácora y reglas · 400 tareas y almacenamiento · 500 endurecer funciones (versión sin borrar) |
| Asesor de seguridad | Limpio, salvo *leaked password protection* (solo plan Pro) |
| Datos iniciales | `supabase/seed.sql` (equivalente a `prisma/seed.ts`) |
| Auth | TOTP activo · registro público cerrado · sesiones 12 h/30 min no disponibles en plan Free (la app cierra por inactividad) |
| GitHub | `Place2work/rpd-control` (privado) |
| Vercel | `https://rpd-control.vercel.app`, equipo place2work (Hobby; Pro para uso comercial) |
| Director | retiropordesempleo.com@gmail.com, 2FA TOTP verificado (27-oct) |

## 28-oct-2026 · Fase 2: hoja PDF y formulario del sitio

- **Hoja de precalificación** (11.4): `GET /api/casos/{id}/hoja` genera el PDF del último cálculo
  con @react-pdf/renderer, Poppins e Inter (licencia OFL, en `src/lib/pdf/fuentes`). Pasa por RLS:
  solo la ve quien puede ver el caso.
- **`POST /api/leads`**: firma HMAC-SHA256 sobre `timestamp.cuerpo`, ventana de 5 minutos. El
  prospecto entra a la bandeja general con dueño = primer Director activo. Mismo WhatsApp con caso
  abierto del mismo servicio: no se duplica, se anota y se avisa. El sitio no manda CURP ni NSS.
  Contrato completo en `docs/INTEGRACION_SITIO.md`. Requiere `LEADS_HMAC_SECRETO` en Vercel y en el sitio.

## 28-oct-2026 · Fase 3: dinero, comisiones y reportes

Decisiones de Irving (14.3), ya cargadas como parámetros:
- **Base del 30% y del 5% del vendedor:** depósito neto (después de ISR). `BASE_HONORARIO=neto`, `BASE_COMISION_VENDEDOR=igual_honorario`.
- **Reparto del socio:** sobre el subtotal sin IVA. `BASE_REPARTO_SOCIO=subtotal` (T13: $834.48).
- **Escalón de referidos:** 1–2 = $1,000, 3–10 = $2,000, 11+ = $3,000 c/u; cuentan solo clientes con honorario
  cobrado en el mes calendario (el del primer cobro del caso). Mientras el mes está abierto la comisión es estimada;
  al cambiar de mes la tarea diaria la devenga con fecha del último día del mes.
- **Facturación:** solo se captura el folio de la factura en el cobro. Sin facturador integrado.
- **Pensiones, M40 e Infonavit:** sin comisión de vendedor hasta definir (valor por defecto de 14.3).

Supuestos míos (cámbialos en Configuración o avísame):
- **Costo administrativo del socio ($500):** se descuenta **una vez por caso** (en el primer cobro), no en cada
  mensualidad de la modalidad B. Parámetro `COSTO_ADMIN_SOCIO_POR` (`caso` | `cobro`).
- Fallecimiento: los componentes fijos (pago inicial, primera mensualidad) se pagan una sola vez; el 5% de lo
  recuperado, en cada cobro con ese concepto. No generan estimadas (los montos son inciertos).

Diseño:
- `src/lib/reglas/comisiones.ts` (puro) calcula el estado **deseado** de las comisiones de un caso; `src/lib/dinero/motor.ts`
  lo concilia con la tabla por `clave` (`vendedor:pago:2`, `socio:cobro:<id>`, `referido`…). Las pagadas no se tocan.
- El motor corre como **proceso del sistema** (`prismaSistema`), igual que la tarea diaria: RLS solo deja al Director
  escribir comisiones, y el motor se llama después de que el usuario registró con sus permisos el pago o el cobro.
- `liquidaciones` agrupa las comisiones pagadas de un beneficiario en un mes (estado de cuenta reimprimible).
- Migración `20261028000800_dinero` (solo agrega): `comisiones.clave` con índice único parcial, `cobros.concepto`,
  `cobros.motivo_cancelacion` (obligatorio al cancelar), tabla `liquidaciones` con RLS y bitácora.

## 28-oct-2026 · Fase 4: decisiones con los contratos vigentes

Irving entregó sus contratos vigentes (retiro RP-27 y pensión por fallecimiento RP-29) y el aviso de privacidad.
Los documentos de clientes no se guardan en el repositorio: se convirtieron en plantillas con variables.

- **Honorario del retiro: 26% IVA incluido** (antes 30%). Parámetro `HONORARIO_RETIRO_PCT` con vigencia desde
  2026-10-28; el 30% queda vigente hasta el 27-oct para reproducir cálculos viejos. Los casos de prueba de la
  sección 14 siguen usando 30% porque reciben los parámetros explícitos.
- **Vigencia del contrato de retiro: 180 días naturales** (antes 90). `VIGENCIA_CONTRATO_DIAS` con la misma vigencia.
- **Cobro del retiro:** se queda como está (un cobro por cada pago de la Afore). El anticipo del 50% que menciona
  el contrato no se modela por ahora.
- **Responsable de los datos personales: Irving Ortega Valois, persona física** (nombre comercial
  RetiroPorDesempleo.com). La plantilla del aviso de privacidad se corrige (el original decía «S.A.S.»).
- **Portal del cliente:** no por ahora.
- **Calendario:** suscripción con liga privada (.ics) por usuario; sin conexión OAuth con Google.
- **Asistente de precalificación en 4 pasos:** sí, en esta fase.

### Contratos desde plantilla (fase 4)
- Plantillas en `prisma/plantillas/*.md` (texto de Irving con variables `{{…}}`); `scripts/plantillas-ts.cjs` genera
  `src/lib/contratos/plantillas-iniciales.ts` y la versión 1 se carga a la base la primera vez que se usa. Una
  versión nueva se agrega como renglón con su vigencia; los contratos viejos no cambian.
- Cambios al texto original, mínimos: «en particular el estado civil asentado en el acta de defunción» (fallecimiento,
  PRIMERA b) es un dato del caso; las advertencias de la TERCERA son una lista por caso; el aviso de privacidad dice
  que el responsable es Irving, persona física (antes «S.A.S.», «empresa privada… afiliada»).
- Beneficiaria y finado en `partes_caso` con CURP/NSS cifrados. Al generar el PDF solo se descifran los datos que la
  plantilla imprime, cada uno con renglón VER_SENSIBLE en la bitácora. El vendedor no genera contratos.
- Aviso de privacidad de retiro recibido el 28-oct (`prisma/plantillas/aviso-retiro.md`), con el mismo ajuste del
  responsable (Irving, persona física). La versión simplificada y la nota para revisión legal del documento no se
  cargan en la plantilla integral.
- Pendiente: variante de contrato cuando la viuda contrata directamente o por concubinato.

### Pensión y Modalidad 40 (7.6)
- Pago M40: vence el **día 17 del mismo mes que cubre** (por adelantado, como dice 7.6). Las fuentes públicas
  coinciden en el día 17 pero no en si es del mismo mes o del siguiente: `M40_DIA_LIMITE` y `M40_PAGO_ADELANTADO`
  son parámetros por si hay que cambiarlo.
- El monto mensual de M40 lo captura el asesor (la tasa del IMSS cambia cada año hasta 2030); el sistema no la calcula.
- Conservación de derechos Ley 73: ¼ del tiempo cotizado desde la baja, mínimo 12 meses (art. 150 LSS 1973).
- INFONAVIT_70: el sistema no sabe si hay saldo de vivienda; avisa a los 69 en casos de pensión, M40 y
  devolución Infonavit para que el asesor lo verifique.

### Calendario (10.5 y 8.2)
- Vista mensual y semanal con día 46, fin del candado, límite de 15 días hábiles, límite de resolución de la Afore,
  vencimiento de contrato, pagos M40 pendientes, derecho a M40, conservación de derechos y cumpleaños 60/65.
- Suscripción con **liga privada** por usuario (`/api/calendario/<token>.ics`): el token se muestra una sola vez,
  en la base solo queda su HMAC, generar otra revoca la anterior. La consulta usa RLS con la identidad del dueño.
- En los eventos solo va el folio y el primer nombre del cliente (Google guarda esa información).
- Cada caso descarga su `.ics` desde el encabezado del expediente.

## 29-oct-2026 · Configuración editable (10.9)

- Solo el Director. Secciones: usuarios y roles, parámetros, contratos y avisos, mensajes de WhatsApp, esquemas
  de comisión, días inhábiles y bitácora. Todo pasa por RLS y queda en la bitácora.
- **Parámetros, plantillas y esquemas con vigencia:** el valor nuevo empieza hoy o después y el anterior se cierra el
  día previo; nunca se cambia hacia atrás. Un valor programado a futuro se puede reemplazar antes de que empiece.
- **Usuarios:** invitación por correo de Supabase (llave secreta solo en el servidor); quitar el acceso pone
  `activo = false` (RLS corta todo al instante) y bloquea el inicio de sesión en Supabase. Nadie se borra. El
  Director no puede quitarse a sí mismo el rol ni el acceso, y siempre queda al menos un Director activo.
- **Días inhábiles:** se desactivan en vez de borrarse (migración 1300).
- Esquemas editables desde la pantalla: % del vendedor y escalones del referidor. El reparto del socio se ajusta en
  cada socio; los montos de fallecimiento, en parámetros.
