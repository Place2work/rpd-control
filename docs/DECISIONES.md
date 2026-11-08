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

## 29-oct-2026 · Bloque 1: tablero, filtros, Hoy y desvío

- **Tablero de casos (10.3):** dos embudos (retiro y pensión, cada uno con sus etapas más «Bloqueado» y «Perdido o
  desvío») y dos vistas (tablero y tabla). En computadora se arrastra la tarjeta; el servidor valida con la misma
  `validarTransicion` del expediente. Si falta motivo se pide ahí mismo; si faltan datos (fecha de firma, acuse…)
  se ofrece abrir el caso. En celular se usa «Siguiente paso» del expediente.
- **Filtros de Prospectos:** origen, servicio, vendedor (incluye «sin vendedor»), régimen y días sin contacto
  (desde el último evento o el alta). Se aplican en el servidor y viven en la URL para poder compartirlos.
- **Hoy:** monto retirado del mes = depósitos netos de la Afore; honorarios cobrados del mes con IVA; por cobrar =
  cobros pendientes; comisiones por pagar = devengadas sin pagar; SLA en riesgo = casos con alerta de 15 días
  hábiles. El vendedor no ve las cifras de dinero. Embudo del mes por la etapa actual de los retiros dados de alta
  en el mes.
- **Desvío (resultado 2):** crea un caso del servicio elegido (el sugerido viene preseleccionado) para la misma
  persona, ligado con `caso_origen_id`, con copia de los datos del IMSS. El original pasa a «Perdido o desvío» con
  motivo `no_elegible`; si su etapa no lo permite, se avisa y queda abierto. Un solo desvío por servicio.

## 6-nov-2026 · Honorario pactado y domicilio

- **Honorario del retiro negociado por caso:** el Director escribe el % pactado en la pestaña Dinero (vacío = el
  general del parámetro `HONORARIO_RETIRO_PCT`). Se guarda en `casos.contrato_pct` (el mismo campo del % pactado de
  fallecimiento; no hubo migración). Aplica a los pagos de la Afore que se registren después, al estimado de la
  precalificación y al contrato. Los pagos ya registrados conservan su honorario. Cada cambio queda en Seguimiento.
  Las comisiones del vendedor no cambian (van sobre el monto de la Afore); el reparto del socio sigue el subtotal cobrado.
- **Domicilio:** se captura en Datos personales (el mismo campo que usa el contrato).

## 7-nov-2026 · Cuentas con contraseña temporal (sin correo)

- Mientras no haya SMTP propio, el Director da de alta usuarios con una **contraseña temporal** que el sistema genera
  (4 bloques de 4, sin caracteres confusos, ≈ 92 bits) y muestra una sola vez; no se guarda ni se registra.
- La cuenta se crea confirmada con `app_metadata.debe_cambiar_clave = true` (el usuario no puede quitarla). El proxy
  y `obtenerSesion` mandan a `/mfa` y luego a `/contrasena`; ahí la contraseña propia se guarda desde el servidor y la
  marca se quita en la misma llamada.
- «Generar contraseña temporal» por usuario sustituye la recuperación por correo; el 2FA no cambia.
- «Restablecer verificación en dos pasos» (celular perdido o nuevo): borra todos sus factores en Supabase y le da una
  contraseña temporal; al entrar inscribe el 2FA en el celular nuevo. Pide confirmación. El Director no puede
  restablecer el suyo desde la pantalla.
- Las dos acciones quedan en la bitácora (`CLAVE_TEMPORAL`, `RESTABLECER_2FA`) mediante `app.registrar_accion_cuenta`,
  que solo el Director puede llamar (migración 1400).
- La invitación por correo sigue disponible para cuando se configure Resend.

## 7-nov-2026 · Un retiro, un pago de la Afore

- Modalidad A o sin modalidad elegida: **un solo pago** de la Afore por retiro; después el formulario desaparece.
  Modalidad B: hasta `MODALIDAD_B_MENSUALIDADES_MAX` mensualidades (6; antes estaba escrito en el código), cada una
  con confirmación. Se rechaza un pago con la misma fecha y monto que uno ya registrado.
- El número de pago no se reutiliza: un pago archivado conserva el suyo (antes, registrar después de corregir fallaba).
- RP-0001: el pago 2 era un doble registro del pago 1 (misma fecha y monto, cobro ya cancelado); se archivó con nota en
  Seguimiento.
- **Actualización (mismo día):** un solo pago para todos, también en modalidad B (`MODALIDAD_B_MENSUALIDADES_MAX` = 1
  desde el 7-nov-2026; migración 1600).

## 7-nov-2026 · Próximo retiro del cliente

- Al registrar el pago de la Afore, el caso muestra «Próximo retiro por desempleo de este cliente: a partir del …»
  (depósito + `ANIOS_CANDADO_RETIRO` años, art. 191-II) en Dinero y en Resumen, y lo anota en Seguimiento.
- La tarea diaria revisa los retiros en «Pagado por Afore» u «Honorario cobrado»: aviso `PROXIMO_RETIRO` al asesor
  (o al Director si no hay) y al Director `AVISO_PROXIMO_RETIRO_DIAS` antes (30) y el día que ya puede retirar.

## 7-nov-2026 · Comprobante, el dinero mueve la etapa y «Clientes cerrados»

- **Comprobante de transferencia:** cada cobro puede llevar el comprobante (foto o PDF, sin mínimo de tamaño) en el
  bucket privado «expedientes», carpeta del caso (CHECK `cobros_comprobante_en_su_caso`); se ve con liga de 10 min.
  El vendedor no lo ve ni lo sube. Migración 1700.
- **El dinero mueve la etapa del retiro** (excepción a «no salta etapas»): al registrar el pago de la Afore → «Pagado
  por Afore»; con todos los honorarios cobrados → «Honorario cobrado» (cerrado). Queda en historial y Seguimiento.
  Un caso cerrado no regresa a «Pagado».
- Con el caso pagado o cerrado dejan de mostrarse las alertas del trámite (día 46, prospecto, expediente, plazos);
  siguen las de dinero y la del próximo retiro.
- **Clientes cerrados** (menú): casos en «Honorario cobrado» con depósito, honorario, comprobante y próximo retiro;
  contadores del mes/año/total, filtros (mes, vendedor, próximo retiro en N días) y Excel. El vendedor ve los suyos
  sin montos. Hoy muestra «Clientes cerrados del mes»; la tabla de Casos tiene Activos/Cerrados/Todos.

## 7-nov-2026 · Contrato y aviso firmados

- La pestaña Contrato permite subir la copia firmada del contrato y del aviso de privacidad. Son documentos del
  expediente de tipo «Contrato firmado» y «Aviso de privacidad firmado» (mismo bucket y políticas; el vendedor no los
  ve). Opcionales: no cambian los requisitos de etapa. Migración 1800.

## 7-nov-2026 · Días administrativos, costo por alta y orden de Prospectos

- **Días administrativos** (`DIAS_ADMINISTRATIVOS`, 10, con vigencia): margen de la empresa después del día 46 para
  ingresar el trámite. No cambia la regla legal (cálculo y etapas siguen con el día 46). Se muestran las dos fechas
  («Día 46 en N días» → «Cumplió 46 días · trámite en N días» → «Listo para trámite») en Prospectos, Casos, Hoy y
  Resumen. Alertas: el día 46 dice cuándo toca el trámite y `TRAMITE_LISTO` (crítica) al terminar el margen.
- **Costo administrativo por alta** (`COSTO_ADMIN_ALTA`, $500, con vigencia): cada prospecto dado de alta (sin
  archivados ni desvíos) se valúa con el costo vigente el día de su alta. Se ve en Prospectos (mes y total; respeta el
  filtro de vendedor) y en Hoy. El vendedor no lo ve.
  Es solo informativo (publicidad, oficina, nómina…): no se descuenta de comisiones ni de cobros.
- **Prospectos** se ordenan por defecto por fecha para retirar: primero los que ya pueden (el más antiguo arriba),
  luego los que les faltan días y al final sin fecha de baja; en Filtros, «Altas más recientes».

## 7-nov-2026 · Pago esperado de la Afore (honorario proyectado)

- En la pestaña Dinero de un retiro sin pago registrado se captura el monto que pagará la Afore (y una fecha estimada
  opcional) en `casos.monto_afore_esperado` / `fecha_afore_estimada`. Proyecta el honorario con el % pactado.
- No es un pago: no mueve la etapa, no cuenta como monto retirado ni genera el próximo retiro. Al registrar el
  depósito real (con fecha) el formulario ya trae el monto y la proyección deja de contar.
- Se suma en Hoy («Por cobrar · + proyectado») y en Dinero («Honorario proyectado» con la lista). Migración 2100.
- **Actualización:** el honorario general del retiro vuelve a **30% desde el 7-nov-2026** (26% del 28-oct al 6-nov).
  El campo «Porcentaje pactado con el cliente» siempre viene lleno con el % que aplica; al guardarlo queda fijo para ese
  cliente aunque el general cambie después.

## 7-nov-2026 · Domicilio por partes

- Datos personales captura calle, número exterior, número interior, colonia y código postal (todo opcional) y elige
  estado y municipio de la lista del INEGI (AGEEML, `public/catalogos/municipios-mx.json`: 32 estados, 2,476
  municipios). El código postal sugiere el estado; la persona decide.
- `personas.domicilio` (lo que va en el contrato) se arma con las partes al guardar; sin partes se conserva el texto
  escrito antes. Valores anteriores que no están en la lista se muestran como «capturado antes». Migración 2200.

## 7-nov-2026 · Eliminar notas del seguimiento

- «Eliminar» en la línea de tiempo archiva la nota (`eventos.archivado_at/archivado_por`): deja de verse y de contar
  como último contacto; no se borra. Solo notas escritas por personas (nota, llamada, WhatsApp, correo; CHECK
  `eventos_archivar_solo_notas`) y solo su autor o el Director. Los registros del sistema no se eliminan. Migración 2300.

## 7-nov-2026 · Corregir pagos de la Afore

- Las fechas de dinero (depósito, cobro) no aceptan años antes de 2000 ni futuras: RP-0002 tenía un depósito con fecha
  0001-01-01 capturado para salir del paso, que lo movió a «Pagado por Afore».
- En «Corregir» de cada pago (solo Director): **Cambiar fecha** (monto y honorario igual), **Regresar a pago esperado**
  (archiva el pago, cancela su cobro pendiente, deja el monto como proyección y regresa el caso a la etapa previa al
  salto automático; no si el honorario ya se cobró) y **Archivar** (registro por error).

## 8-nov-2026 · Comisión propia por vendedor y altas sin duplicar

- Cada vendedor puede tener su propio % de comisión del retiro (`usuarios.comision_pct`, Configuración → Usuarios →
  Editar, de 1% a 20% en medios puntos); vacío = el del esquema vigente (5%). Al cambiarlo se recalculan sus comisiones
  no pagadas; las pagadas no cambian. Migración 2400.
- Altas de referidores, socios y usuarios: el formulario se limpia al guardar y un nombre ya registrado se avisa (había
  quedado «JUAN CARVAJAL» dos veces; se archivó el duplicado sin casos).

## 8-nov-2026 · Alta con varios servicios

- El alta rápida permite marcar varios servicios: se crea un caso por servicio para la misma persona (cada uno con su
  embudo, contrato, cobro y comisiones). El seguimiento de cada caso anota qué más pidió.
- El costo administrativo cuenta una alta por persona (su primer caso), no por servicio.
- Nombres del catálogo: «Pensión Ley 73 (cesantía, vejez, invalidez)» y «Devolución Infonavit (subcuenta de vivienda)»
  (la clave no cambia). Migración 2500.

## 8-nov-2026 · Costo administrativo propio de un alta

- Cada alta puede llevar su propio costo administrativo (`casos.costo_admin_alta`, pesos, 0 o más): p. ej. $0 en una
  pensión o más en otro servicio. Vacío = el general (COSTO_ADMIN_ALTA vigente el día del alta).
- Lo fija solo el Director: en el alta rápida o en la pestaña Dinero del caso. Se guarda en todos los casos vivos de la
  persona (el costo se cuenta una vez por persona, en su primer caso). Un trigger impide que otro rol lo cambie.
- El alta sigue contando en «altas» aunque su costo sea $0. Migración 2600.

## 8-nov-2026 · Nombres de las figuras

- «Asesor» se llama **Analista de expedientes** y «Socio licenciatario» se llama **Asesor de pensiones**. Solo cambian
  los nombres en pantalla, PDF y reportes; las claves internas (`asesor`, `socio`) y las reglas de RLS no cambian.
- Llevan cuenta: Director, Analista de expedientes y Vendedor. El asesor de pensiones y el referidor no entran al
  sistema: se dan de alta en Comisiones → Referidores y asesores y se eligen en cada caso. El asesor de pensiones
  conserva su reparto ((honorario sin IVA − su costo administrativo) × su %). Migración 2700 (nombre del esquema).

## 8-nov-2026 · Tres esquemas (sin vendedor)

- Solo hay tres figuras: **Analista de expedientes** (cuenta, sin comisión), **Asesor de pensiones** (cuenta, reparto
  (honorario sin IVA − su costo) × su %, por omisión 40% y $500, ajustable por persona en Comisiones → Referidores y
  asesores) y **Referidor** (sin cuenta, escalones mensuales). La entrada anterior sobre «sin cuenta» del asesor queda sustituida.
- La cuenta de un asesor de pensiones se liga a su ficha (rol `socio` + `socio_id`): al crearla se elige una ficha
  existente o se crea una nueva con su nombre. Una ficha no puede tener dos cuentas activas.
- Vendedor: ya no se crean cuentas, no aparece en el canal ni en filtros, y sus esquemas se cerraron el 7-nov-2026
  (migración 2800; no se borran). Los filtros y columnas de Prospectos, Casos y Clientes cerrados muestran al asesor de pensiones.
- Al ajustar el reparto de un asesor se recalculan sus comisiones no pagadas; las pagadas no cambian.

## 8-nov-2026 · Un solo costo administrativo

- El costo que se descuenta del reparto del asesor de pensiones es el **costo administrativo del alta** del cliente:
  el propio de su alta (pestaña Dinero del caso) o el general COSTO_ADMIN_ALTA vigente el día de su primer caso
  (`costoDeAlta`, src/lib/reglas/costo-alta.ts). Fórmula: (honorario sin IVA − costo del alta) × % del asesor.
- La ficha del asesor solo guarda su %; la columna `socios.costo_administrativo` deja de usarse (no se borra).
- Cambiar el costo de un alta recalcula las comisiones sin pagar del asesor de esos casos; las pagadas no cambian.
- Ejemplo (35,190 netos, honorario 30%): subtotal $9,100.86 − $500 = $8,600.86 × 40% = $3,440.34 para el asesor.

## 8-nov-2026 · Reparto del asesor sobre el honorario con IVA

- Desde el 8-nov-2026 `BASE_REPARTO_SOCIO = total`: (honorario cobrado con IVA − costo administrativo del alta) × %
  del asesor; el resto es de la empresa. La vigencia anterior (subtotal) cerró el 7-nov (migración 2900).
- Ejemplo (35,190 netos, 30%): (10,557 − 500) × 40% = $4,022.80 asesor; $6,034.20 empresa. El IVA trasladado
  ($1,456.14) se sigue declarando y sale de la parte de la empresa.

## 8-nov-2026 · Factura del asesor («cada quien paga su IVA») y proyección de comisiones

- La comisión del asesor de pensiones es el **total de su factura, IVA incluido** (opción A). Se desglosa con
  `facturaAsesor` (subtotal + IVA) en la pestaña Dinero, en Comisiones (factura por lo por pagar) y en su PDF.
- El margen usa el **IVA neto**: IVA del honorario − IVA acreditable de las facturas de los asesores
  (`margenCaso`, reporte «Margen por canal»). Ejemplo 35,190 al 30%: IVA neto $901.27.
- Retenciones de ISR/IVA al asesor: pendientes de definir con el contador (no se calculan todavía).
- Canal del caso (retiro): al elegir asesor o referidor se muestra la proyección (`proyectarComisiones`) con el
  honorario más firme disponible: cobros > pagos de la Afore > pago esperado > cálculo. Otros servicios: sin comisión.

## 8-nov-2026 · Comisiones proyectadas por pagar

- Nuevo módulo: tarjeta en Hoy y sección «Comisiones proyectadas por pagar» en Comisiones (#proyectadas).
- Cuenta todo lo que falta pagar a asesores de pensiones y referidores en retiros vivos (no perdidos): por caso y
  tipo, las comisiones sin pagar si ya existen (devengadas o estimadas); si no hay ninguna, la proyección con el
  honorario más firme (`honorarioParaProyectar`: cobros > pagos > pago esperado > cálculo). Lo pagado no se cuenta.
- El Director ve todo con desglose por beneficiario; el asesor de pensiones ve solo lo suyo.

## 8-nov-2026 · Asesor sin correo, comisiones por asesor en Hoy y logotipos de las Afores

- Configuración → Usuarios: un asesor de pensiones puede darse de alta sin correo (se crea solo su ficha y ya cobra
  comisiones). Aparece en «Asesores de pensiones sin cuenta»; al escribir su correo se crea su cuenta con
  contraseña temporal (`crearCuentaAsesor`), ligada a su ficha. Una ficha no puede tener dos cuentas activas.
- Hoy (Director): tabla «Comisiones proyectadas por pagar» por beneficiario (devengado, proyectado y total).
- Logotipos de las 10 Afores en public/afores/<CLAVE>.png (proporcionados por la empresa) en la insignia de la
  Afore: expediente, lista de Prospectos, tabla de Casos y Clientes cerrados. Sin logotipo: iniciales con su color.

## 8-nov-2026 · Ganancia proyectada

- Tarjeta en Hoy (solo Director): honorarios por cobrar + proyectados (con IVA) − comisiones proyectadas por pagar −
  costo administrativo total de las altas (`gananciaProyectada`). La nota muestra la cifra «sin IVA», que descuenta el
  IVA neto (IVA del honorario − IVA acreditable de las facturas de los asesores). IVA del parámetro, no fijo.
- (8-nov) La ganancia suma también lo ya cobrado desde el inicio (p. ej. RP-0001, cliente cerrado) y resta las
  comisiones ya pagadas, para cuadrar con el costo total de las altas. Cuadro en amarillo; «proyectada» en verde.

## 8-nov-2026 · Gráficas de finanzas en Hoy (Director)

- «De dónde sale la ganancia» (cascada): cobrado + por cobrar y proyectado − comisiones − altas = ganancia
  (`cascadaGanancia`). «Honorarios por mes» (barras apiladas, 12 meses): cobrados y proyectados por la fecha
  estimada del depósito (`flujoHonorarios`). Comisiones proyectadas por beneficiario (barras) sobre su tabla.
- Colores validados para daltonismo con el validador del skill de visualización: azul #004AAD, magenta #C2255C,
  verde #5E9E3A. En celular las etiquetas del eje se abrevian o se espacian.

## 8-nov-2026 · Revisión general del sistema

- Recorrido automático de 65 pantallas (todas las secciones, reportes y las 9 pestañas de cada caso) y descargas
  (contrato, hoja, .ics, Excel): sin errores. Registros de Supabase: sin errores del sistema.
- 19 revisiones de integridad de datos en producción en cero (IVA, fechas, pagos duplicados, cerrados sin cobro,
  vigencias encimadas, fichas sin cuenta, etc.).
- Migración 3000: search_path fijo en `app.tg_costo_admin_alta` (aviso de seguridad) e índices de llaves foráneas
  más consultadas. «Comisiones por pagar» excluye las archivadas.
- `experimental.instantInsights.validationLevel = "manual-warning"`: toda pantalla depende del usuario (el layout ya
  es `instant = false`); los avisos de navegación instantánea en desarrollo eran falsos positivos.
- Pendiente del usuario: activar «Leaked password protection» en Supabase → Authentication (si el plan lo permite).

## 8-nov-2026 · Casos de pensión en la tabla de comisiones

- La tabla de Hoy por beneficiario cuenta los casos de cada asesor de pensiones y referidor por familia: Retiro,
  Pensiones (PENSION_L73, PENSION_L97, FALLECIMIENTO) y Otros (solo si hay). Las pensiones muestran «monto por
  definir»: su comisión se define cuando el IMSS resuelva. Los montos siguen siendo solo del retiro (`casosPorBeneficiario`).
- (8-nov) Configuración → Usuarios: «Editar» en cada asesor de pensiones sin cuenta (nombre y teléfono de su ficha,
  `actualizarFicha`; nombre repetido se avisa). Al editar un usuario asesor con cuenta, su ficha toma el mismo nombre.

## 8-nov-2026 · Fallas de Auth como aviso, no como pantalla de error

- Crear una cuenta de asesor en producción mostró «This page couldn't load»: la petición nunca llegó a Supabase Auth
  (registros limpios), lo que apunta a que falta `SUPABASE_SECRET_KEY` en Vercel. Las operaciones de src/lib/auth/admin.ts
  ahora regresan `{ error }` (con el aviso de la llave faltante) en vez de lanzar una excepción.
- (8-nov) Cambio de contraseña temporal: Supabase revoca las sesiones al cambiarla desde el servidor, así que la
  pantalla se quedaba en «Guardando…». Ahora, si la sesión no se renueva, cierra la local y manda a /login con el
  aviso «tu contraseña quedó guardada».
- (8-nov) Toda contraseña (temporal, invitación o recuperación) se guarda desde el servidor (`cambiarClavePropia`,
  `cambiarClaveTemporal`); el cliente espera a Supabase con límite de tiempo y, si la sesión fue revocada, manda a
  /login con «tu contraseña quedó guardada». Enlace «¿Ya tienes contraseña? Ir al inicio» en la pantalla normal.

## 8-nov-2026 · Pantalla de inicio del asesor de pensiones

- Para el rol `socio`, Hoy habla de SUS comisiones: retiros de mis clientes del mes, mis comisiones por cobrar
  (devengadas), mis comisiones proyectadas, comisiones cobradas, mis casos de pensión (monto por definir) y la tabla
  «Mis comisiones por caso» en lugar de «Ingresos de los últimos 12 meses». No ve honorarios, costo administrativo,
  ganancia ni comisiones de otros. Director y analistas sin cambios.
- Modo demostración (solo desarrollo): `RPD_DEMO_ROL` y `RPD_DEMO_SOCIO` para revisar la pantalla de otro rol.

## 8-nov-2026 · Ficha duplicada de Juan Carlos Arteaga Gomez

- Su cuenta se creó con «Nueva con su nombre» y quedó en una ficha vacía; sus 4 casos (RP-0006, 0007, 0008, 0010)
  estaban en la ficha «Juan Carvajal» (mismo teléfono). Se ligó la cuenta a esa ficha, se le puso su nombre completo
  y correo, y la ficha vacía se archivó (sin borrar).
- Prevención (`fichaParecida`): al crear un asesor con ficha nueva, si ya hay una ficha sin cuenta con el mismo
  teléfono o nombre, se pide elegirla (con correo) o editarla (sin correo). Se revisa antes de crear la cuenta en Auth.

## 8-nov-2026 · «Ver como asesor» (Director, solo lectura)

- Configuración → Usuarios: botón «Ver como» en cada asesor de pensiones con cuenta activa. Guarda una cookie httpOnly
  (2 h) con su id; `obtenerSesion` solo la respeta si quien entra es Director, y entonces la sesión toma la identidad
  del asesor (RLS con su id) con `ver_como: true` en los claims.
- Solo lectura en dos capas: `conUsuario` abre la transacción con `SET TRANSACTION READ ONLY`, y toda acción de
  servidor se detiene antes de tocar datos (aviso «No se guardó» en la barra amarilla). El contrato en PDF se
  muestra sin registrar que se generó.
- Cada activación queda en la bitácora (`registrar_accion_cuenta(..., 'VER_COMO')`, migración 3100). Salir borra la
  cookie; cerrar sesión también.
