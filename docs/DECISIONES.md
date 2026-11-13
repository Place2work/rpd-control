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

## 8-nov-2026 · Recuperar contraseña en cualquier dispositivo

- Con Resend activo, la liga de recuperación fallaba al abrirla en otro dispositivo: el navegador pedía el correo en
  flujo PKCE (la liga solo se canjea donde se pidió). Ahora la solicitud sale del servidor (`pedirRecuperacion`,
  flujo implícito) y la liga abre en cualquier dispositivo. Las invitaciones ya salían del servidor.
- Plantillas de Supabase: «Reset password» e «Invite user» en español; sirven con `{{ .ConfirmationURL }}` o con
  `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=…` (el callback acepta ambos).

## 10-nov-2026 · Acceso por correo dentro del alta

- Configuración → Usuarios: la misma alta pregunta «¿Cómo le das acceso?»: invitación por correo (recomendado; Supabase
  manda «Invite user» por Resend) o contraseña temporal. Igual en «Crear su cuenta» de los asesores sin cuenta.
- Botón «Enviar acceso por correo» en cada usuario: manda una liga para poner su contraseña (plantilla «Reset password»,
  flujo implícito, abre en cualquier dispositivo) sin volver a darlo de alta. Bitácora: INVITACION_CORREO y
  ACCESO_CORREO (migración 3200).

## 10-nov-2026 · Alta sin WhatsApp

- El WhatsApp es opcional en el alta rápida y en Datos personales (la BD ya lo permitía): con el nombre basta. Si se
  escribe, se valida a 10 dígitos. Sin teléfono no se buscan duplicados por teléfono (sí por CURP/NSS).

## 10-nov-2026 · El asesor de pensiones captura el pago esperado, con bitácora

- Pestaña Dinero: el «Pago esperado de la Afore» (monto y fecha estimada) lo pueden capturar y actualizar el Director, el
  analista y el asesor de pensiones en sus propios casos (RLS ya lo limitaba a `socio_id = app.socio_id()`).
- Cada cambio deja un evento con `datos.campo = "pago_esperado"`, el valor anterior, el nuevo y el rol de quien lo hizo.
  Se muestra debajo del formulario como «Bitácora de cambios» (últimos 8) y también en Seguimiento. No se borra.
- En «Ver como» sigue siendo de solo lectura: el Director sale del modo para editar.

## 10-nov-2026 · Fotos de menos de 256 KB se suben con aviso

- Cambia 5.6: una foto de menos de 256 KB ya no bloquea la subida (el Director lo pidió; en la práctica llegan fotos
  ligeras que sí se leen). Se sube como «Por revisar» con el aviso «Foto ligera (N KB, la Afore pide mínimo 256 KB):
  revisa que se lea bien antes de validarla», que también queda en Seguimiento. Quien valida decide.
- Siguen bloqueados: formatos distintos de foto/PDF, archivos de más de 15 MB y archivos vacíos.

## 10-nov-2026 · Panel «Asesores y referidores»

- Nuevo módulo `/asesores` (Director y analista): cada asesor de pensiones y cada referidor es una fila que se despliega
  con sus prospectos y casos (Afore, servicio, etapa, comisión por pagar o pago esperado). Cuenta prospectos, en trámite
  y cerrados, y su comisión total por pagar (misma cuenta que «Comisiones proyectadas por pagar»).
- «Editar» en cada caso: nombre, apellidos, WhatsApp, asesor de pensiones y referidor. Cada cambio queda en Seguimiento
  («Editado desde el panel de asesores: …», con antes → después) y, si cambia el canal, se recalculan las comisiones.
- Grupo «Sin asesor ni referidor» con los casos vivos sin asignar, para repartirlos desde ahí. Los perdidos no se listan.

## 11-nov-2026 · Flecha «Regresar» en el expediente

- Arriba del expediente: «← Regresar a <módulo>». Vuelve a la última pantalla fuera de un expediente (con sus filtros),
  aunque se hayan recorrido pestañas del caso. Se guarda en `sessionStorage` (por pestaña del navegador); si no hay, va a Casos.
- En «Asesores y referidores», el asesor desplegado queda en la URL (`?abierto=…#…`) y se vuelve con él abierto.

## 11-nov-2026 · Borrar la fecha de baja; fechas imposibles no pasan

- IMSS y Afore: botón «Borrar» junto a «Fecha de baja» y «Primera alta» (pide confirmación y guarda). Al borrar o
  cambiar la baja queda en Seguimiento (antes → después) y se descartan los avisos DIA46_PROXIMO, DIA46_HOY y
  TRAMITE_LISTO del caso; la tarea diaria crea los de la fecha nueva.
- Se rechazan fechas anteriores a 1940 (p. ej. «01/01/0001») y fechas futuras en baja, primera alta y constancia.

## 11-nov-2026 · Referencias personales; dos documentos menos en el retiro

- Cambia 5.6: el retiro ya no pide «Certificación de baja del IMSS» ni «Comprobante de registro en Afore». Se
  desactivan en el catálogo (`activo = false`, migración 3300): no se muestran ni cuentan como obligatorios. Ningún
  caso los tenía subidos.
- Nueva tabla `referencias_personales` (migración 3300): dos por cliente (van con la persona, sirven para cualquier
  servicio). Nombre completo, teléfono (10 dígitos, distinto del del cliente), parentesco, domicilio, años de conocerlo,
  notas y «confirmada por llamada» (quién y cuándo). RLS con `app.persona_visible`; sin DELETE: «Quitar» la archiva.
  Se capturan en Datos personales; cada cambio queda en Seguimiento.
- (11-nov, después) El alta del prospecto también trae «Referencias personales · opcional» (sección desplegable).
  Vacías no impiden guardar; una empezada se valida completa (nombre, teléfono y parentesco). Se guardan con la persona
  después de crear los casos y quedan en Seguimiento («Referencias en el alta: …»).
- (11-nov, después) El panel «Asesores y referidores» muestra en cada caso sus referencias: nombre, parentesco y
  teléfono (con liga para llamar) y ✓ si está confirmada; liga a Datos personales para agregarlas o editarlas.
- (11-nov, después) Las referencias también se editan desde el panel: dentro de «Editar» de cada caso van Referencia 1
  y 2 con todos sus campos (misma acción `guardarReferencia`, misma validación y mismo registro en Seguimiento).
- (11-nov, después) «Quitar esta referencia» también en el panel (pide confirmación; archiva, no borra; queda en Seguimiento).

## 12-nov-2026 · Lectura automática de la constancia de semanas (IMSS)

- No se automatiza el portal del IMSS (captcha, correo de verificación): solo se lee el PDF que ya está en el expediente,
  venga del IMSS o de otro proveedor.
- Documentos → «Constancia de semanas cotizadas» (PDF): botón «Leer constancia». El texto se extrae en el servidor con
  `unpdf` (src/lib/constancia/extraer.ts, renglones por posición) y la regla pura `leerConstancia`
  (src/lib/reglas/constancia.ts) saca nombre, NSS, CURP, fecha de emisión, folio, semanas (cotizadas, descontadas,
  reintegradas, total) y la historia laboral; deriva fecha de baja, primera alta, último patrón, último SBC y si sigue
  cotizando, y avisa si el total no cuadra.
- Candado de identidad: NSS y CURP se comparan por hash HMAC con los del cliente; si alguno no coincide no se pasa nada.
  Si el cliente no los tenía, se ofrece guardarlos cifrados.
- Se muestra «En la constancia / En el caso» con casillas (vienen marcadas las que cambian). «Pasar a IMSS y Afore»
  vuelve a leer el PDF en el servidor (no confía en el navegador), recalcula semanas totales, régimen (si estaba por
  definir) y bimestres (si no había), descarta avisos del día 46 si cambió la baja y deja todo en Seguimiento.
- Pruebas con una constancia ficticia del mismo formato; las reales del Director solo se usaron en la carpeta temporal.
- Pendiente: SBC promedio de las últimas 250 semanas (pensión Ley 73) a partir de los movimientos.
- (12-nov, después) La lectura indica sola el régimen: Ley 73 si la primera alta es anterior al 1-jul-1997, si no
  Ley 97. Se muestra arriba de la tabla y como renglón «Régimen» (no se marca solo si en el caso se cambió a mano con
  justificación). Al pasarlo se borra la justificación anterior.

## 12-nov-2026 · Trámite oficial asistido de la constancia (buzón de constancias)

- Documentos → «Pedir constancia al IMSS»: pasos guiados en el portal oficial (la persona resuelve el captcha), con
  CURP y NSS completos (ver completo deja bitácora) y botones «Copiar», y el correo de la empresa
  `constancias@recibe.retiropordesempleo.com` (subdominio con recepción en Resend; el correo del dominio principal sigue
  en Hostinger). «Ya la pedí» crea una solicitud (tabla `solicitudes_constancia`, migración 3400).
- `/api/correo/entrante`: aviso `email.received` de Resend con firma Svix (RESEND_WEBHOOK_SECRET); lee el correo y sus
  adjuntos con la API de Resend (RESEND_API_KEY). Proceso del sistema (`prismaSistema`, como /api/leads; anotado en
  CLAUDE.md). Solo acepta correos al buzón, de imss.gob.mx y con DKIM o SPF aprobados; los demás se descartan.
  - Constancia en PDF → se liga al cliente por hash de NSS/CURP (solicitud viva o caso vivo que pida constancia), se
    guarda en el expediente con la llave del servidor y queda «Por revisar»; aviso CONSTANCIA_RECIBIDA.
  - Liga de confirmación (solo https de imss.gob.mx, también validado en la base) → botón «Confirmar en el IMSS» en el
    caso; aviso CONFIRMAR_CONSTANCIA. Se liga por CURP/NSS del texto o, si no trae, a la única solicitud de las últimas 6 h.
  - Lo demás → bandeja «Correos del IMSS» (/correos-imss, Director y analista) con aviso en Hoy; al asignar una
    constancia se vuelve a descargar y se rechaza si el NSS/CURP no son del caso. Idempotente por id de Resend.
- `correos_entrantes`: solo la escribe el sistema; el Director y el analista la ven y asignan; sin DELETE.
- Corrección: pdf.js deja vacío el búfer que lee; se le pasa una copia (si no, se guardaba un PDF de 0 bytes).
- Pendiente del Director: recepción en Resend para `recibe.retiropordesempleo.com` (registro MX), webhook a
  `https://admin.retiropordesempleo.com/api/correo/entrante`, RESEND_API_KEY y RESEND_WEBHOOK_SECRET en Vercel, y un
  renglón en el aviso de privacidad sobre la solicitud de la constancia con autorización del cliente.

## 12-nov-2026 · Aviso de privacidad versión 2 (2026-11): solicitud de la constancia ante el IMSS

- Retiro y fallecimiento: nueva finalidad primaria «Con su autorización, solicitar en su nombre ante el IMSS su (la)
  Constancia de Semanas Cotizadas, utilizando un correo electrónico de la empresa para recibirla, con el único fin de
  integrar su expediente y realizar el trámite contratado». En «usted», como el resto del aviso.
- Sección 4 ajustada para no contradecirse: la constancia es la única excepción a «usted realiza personalmente los
  trámites ante el IMSS» (retiro) y a «la beneficiaria presenta personalmente las solicitudes» (fallecimiento).
- Producción: versión 2 de ambos avisos vigente desde el 11-nov-2026 (hora CDMX); la versión 1 queda cerrada, no se
  borra. PRIVACIDAD_VERSION = 2026-11 desde la misma fecha (quien acepte desde hoy queda con 2026-11).
- Los clientes que aceptaron la 2026-10 no autorizaron esta finalidad: antes de pedir su constancia con el buzón de la
  empresa, que firmen el aviso nuevo (Contrato → aviso de privacidad) o den su autorización por escrito.
- prisma/plantillas/*.md y el seed alineados (scripts/plantillas-ts.cjs regenera plantillas-iniciales.ts).

## 13-nov-2026 · Academia, fase A (docs/CAPACITACION.md)

- Decisiones del Director (13-nov): la Academia es **obligatoria para los asesores de pensiones** (rol `socio`; el rol
  «vendedor» del plan ya no existe); analistas y Director la toman como repaso, sin efecto en permisos. El contenido se
  **ajusta a lo vigente** (DECISIONES prevalece sobre el plan). Los **bloqueos por certificación** (fase B) se
  construirán con un **interruptor apagado** hasta que el Director lo encienda. Entrega **por fases**.
- Vocabulario del plan → sistema: «vendedor» = asesor de pensiones; «asesor» (quien valida y planea la pensión) =
  Director.
- Contenido versionado en `content/academia/` (21 módulos .md con encabezado JSON, 61 preguntas en JSON en lugar de
  YAML para no sumar dependencias, `rutas.json` con los requisitos de 3.2, `evaluacion.json` con 9.3, `acuses.json`).
  `npm run academia:contenido` lo empaqueta en `src/lib/academia/contenido.ts` (solo servidor: trae las respuestas).
  En fase A el contenido no va a tablas (el plan lo permite: «se carga desde archivos»); las tablas cap_modulos y
  cap_preguntas llegan con la fase D (edición y estado «revisar»).
- Adaptaciones al contenido del plan:
  - N0-01: Comisión: del 5% del vendedor al esquema vigente del asesor de pensiones ((honorario − costo del alta) × su %).
  - N0-01: Ejemplo de memoria recalculado con el esquema vigente ($1,000).
  - N0-02: Se agregó el cuadro «qué sí / qué no» de la sección 2 del plan.
  - R1-01: Se explican las dos fechas del sistema (día 46 legal y fecha de trámite con días administrativos).
  - R1-02: SBC promedio: ya no se depende de la Certificación de baja (dejó de pedirse).
  - R1-04: Certificación de baja: ya no se pide; se agregó la lectura automática de la constancia y el régimen automático.
  - R1-06: Checklist: se quitaron la Certificación de baja y el Comprobante de registro en Afore (ya no se piden).
  - R1-06: Fotos de menos de 256 KB: se suben con aviso. Se agregó «Pedir constancia al IMSS».
  - R1-07 · P1-04 · P1-05: Se anexaron los guiones y la tabla de objeciones de la sección 8.
  - N0-Q08: Comisión recalculada con el esquema vigente del asesor de pensiones.
  - R1-Q14: La Certificación de baja ya no se pide; la pregunta pasa a fotos de menos de 256 KB.
  - R1-Q12: Opción c: «la del vendedor» → «la tuya».
  - R1-Q01: Se liga también a DIAS_ADMINISTRATIVOS (no cambia la respuesta).
  - Lecciones: se quitaron nombres técnicos de tablas (cap_incidencias, cap_acuses, tipos_servicio, lib/reglas).
- Tablas (migración 3500): cap_progreso, cap_intentos, cap_certificaciones, cap_acuses, con RLS (cada quien lo suyo;
  el Director todo; sin DELETE). Intentos y certificaciones solo los escribe el motor (`src/lib/academia/motor.ts`,
  `prismaSistema`, anotado en CLAUDE.md) para que nadie se autoapruebe.
- Reglas puras en `src/lib/reglas/capacitacion.ts`: preguntas al azar reproducibles (todas las críticas en el examen),
  aprobación con mínimo **y** 100% de críticas, intentos (quiz ilimitado con 1 h de espera tras reprobar; examen 3
  intentos y 7 días de bloqueo), estado de ruta y vigencia.
- Requisitos en fase A: N0 = acuses + 4 lecciones + examen N0 → certificación automática. R1–P2: lecciones y examen
  (requiere el examen de la ruta previa); la certificación espera casos prácticos, juegos de roles y acompañamientos
  (fases B y C). Lecciones de R/P se abren con N0 certificada. Los quizzes de módulo son práctica (no requisito).
- Pantallas: Academia (Mi ruta, con acuses al entrar), Lección (recuadros «Lo que dices» azul / «Lo que nunca dices»
  rojo), Evaluación (una pregunta por pantalla, sin regresar, revisión de errores con críticas resaltadas), Equipo
  (Director). Aviso en Hoy al asesor de pensiones sin N0.

## 13-nov-2026 · Academia, fase B: simulador, permisos por certificación (interruptor apagado) y excepciones

- **Casos prácticos** en `content/academia/casos.json`. C-R01 a C-R09 traen los datos de entrada del motor y su
  resultado esperado; una prueba (`capacitacion.test.ts`) verifica que **coinciden con `precalificar()`** (montos al
  centavo, semanas a 0.1): el contenido no puede contradecir al sistema. C-P01 a C-P07 (pensión) son de opción múltiple,
  porque el motor no calcula pensiones; sus opciones salen del «qué debe contestar» del plan (sección 7).
  - Asignación: R1 = C-R01, 02, 03, 04, 08, 09 (pide 4); R2 = C-R05, 06, 07 (pide 3); P1 = C-P01 a 06 (pide 4); P2 = C-P07.
  - C-R01: la comisión de la explicación usa el esquema vigente ($1,600, no el 5% del plan).
- **Simulador** (`/academia/casos/[clave]`): en lugar de repetir los 4 pasos del asistente, el asesor lee el caso
  ficticio y captura resultado, montos A/B, semanas, honorario, fecha, incrementos o la modalidad que resalta el
  sistema; el servidor lo compara con el motor (montos ±$1, semanas ±0.1) con los parámetros vigentes. No crea
  personas ni casos. Los intentos (`cap_casos_intentos`) los escribe el motor.
- **Permisos (3.2)** en la base: `cap_permisos_ruta` (cada ruta incluye los permisos de sus prerrequisitos; una prueba
  la compara con rutas.json), `app.tiene_permiso`, `app.permiso_de_otro` (Director y analista), vista
  `v_permisos_usuario`. Solo aplican al asesor de pensiones (rol socio). **Interruptor `ACADEMIA_BLOQUEOS`**
  (parámetro con vigencia): **apagado** al entregar; el Director lo enciende o apaga en Academia → Avance del equipo.
  - Encendido: alta de prospectos con N0; precalificar retiros con R1 (además, candado RESTRICTIVO en `calculos`);
    cliente Ley 73 sin R2 → no se muestra el resultado y se crea la alerta REVISION_L73 al Director y a quien tiene el
    caso; contrato de retiro con R1; recibir prospectos de pensión con P1 (al darlos de alta y cuando se le asigna un
    caso de pensión a un asesor con cuenta).
  - Pendiente para fases siguientes: `documentos.solicitar`, `analisis_impacto.borrador`, `caso.desvio.crear`,
    `diagnostico_inicial.capturar` y los permisos de P2 están en la tabla pero todavía no bloquean nada.
- **Excepción temporal** (`cap_excepciones`): solo el Director, con motivo, máximo 30 días; se revoca (archiva), nunca se
  borra.
- **Certificación automática** con casos: R1 y R2 siguen esperando juegos de roles y acompañamientos (fase C).
- **Ayuda contextual**: en la precalificación del caso, el resultado enlaza a su lección (APTO → R1-05,
  CALIFICA_NO_CONVIENE → R2-01, NO_TODAVIA → R1-01, APTO_BLOQUEADO → R1-04, desvío → R2-02), más «cómo se calcula» y
  «semanas que se pierden».
- La prueba con Playwright del plan (sin R1 / R1 / R1+L73 / R2) se cubrió con pruebas de base de datos y un recorrido
  en local (el conjunto e2e actual no tiene sesión con base de datos).

## 14-nov-2026 · Academia, fase C: evaluación humana, incidencias y desempeño

- **Juego de roles** con la rúbrica 9.2 (`content/academia/rubrica.json`, 8 criterios; 4 eliminatorios; aprueba con
  80 puntos y sin fallar ninguno eliminatorio). Escenarios RP-01 a RP-05 en `roleplays.json` (R1: 01-02, R2: 03,
  P1: 04-05). El Director califica desde la ficha de la persona (`/academia/equipo/[id]`), pensada para el celular;
  la persona ve su puntaje, los criterios a mejorar y la retroalimentación en Mi ruta.
- **Casos acompañados** (`cap_shadowing`): R1 pide 3 y R2 pide 2, que deben ser Ley 73 (régimen capturado en el
  expediente; la base lo exige). Se registran por folio. **Diagnósticos validados** (P2 pide 10 sin corrección grave)
  y **entrevista** P2 también los registra el Director. P2 ya se otorga sola al cumplir todo.
- Solo el Director evalúa y nunca a sí mismo (RLS). Cada registro vuelve a revisar si la persona ya se certifica.
- **Solicitudes**: con el examen de la ruta aprobado, el asesor pide su juego de roles, acompañamiento o entrevista
  (una pendiente a la vez por cosa); aparecen en «Por evaluar» del Director y se cierran al evaluar.
- **Incidencias (9.5)**: las registran el Director o el analista, desde la ficha de la persona o desde la pestaña
  Seguimiento del caso (queda un evento en la línea de tiempo). Las de **línea roja** suspenden al momento todas las
  certificaciones de la persona (disparador en la base) y avisan al Director con la alerta CAP_INCIDENCIA_LINEA_ROJA;
  una suspensión bloquea los permisos aunque haya excepción. Solo el Director reactiva o revoca, con motivo.
- **Desempeño (10)**: «Mi desempeño» (asesor de pensiones) y «Desempeño del equipo» (Director), últimos 90 días, con
  reglas puras en `src/lib/reglas/desempeno.ts`. Definiciones:
  - Primer contacto: primera llamada, WhatsApp, correo o nota de una persona dentro de `CAP_CONTACTO_HORAS` (24) desde
    el alta; los que siguen en plazo sin contacto no cuentan.
  - Apto → contrato: contrato generado. Expediente a la primera: casos con documentos y ninguno rechazado (estado
    actual). Bloqueado: casos hoy en Bloqueado (todas las causas; el CRM no guarda si fue causa del asesor).
  - Ley 73 con análisis de impacto: se agregó la meta `l73_analisis` (100%). «Califica, no conviene» → desvío: tiene
    un caso de desvío creado.
  - Alertas a tiempo: atendidas a más tardar `CAP_ALERTA_DIAS` (1) después del disparo, en hora de CDMX; las
    descartadas no cuentan.
  - Coaching: si dos o más métricas quedan debajo de la meta la semana pasada y la anterior, se sugieren sus módulos.
  - Metas en `cap_metas` con vigencia; el Director las cambia desde el tablero (en porcentaje; línea roja en número).

## 15-nov-2026 · Academia, fase D: vigencia, microlecciones de actualización y alertas

- **Vencimiento (9.5)**: R1, R2, P1 y P2 vencen a los 12 meses (`vigencia_meses` en rutas.json; N0 no vence). La
  tarea diaria las pasa a «por vencer» `CAP_POR_VENCER_DIAS` (30) antes y a «vencida» al día siguiente del
  vencimiento; vencida, se pierden los permisos de esa ruta (la base ya solo cuenta vigentes y por vencer).
  - **Recertificación**: examen corto de 15 preguntas de la ruta (mismo mínimo y críticas, 3 intentos, 7 días de
    espera; los intentos de un ciclo anterior no cuentan). Al aprobarla, la certificación anterior se archiva y nace
    una nueva: si aún no vencía, los 12 meses corren desde el vencimiento anterior; si ya venció, desde hoy.
  - Una ruta vencida o **revocada** ya no se vuelve a otorgar sola por cumplir requisitos (antes podía pasar con una
    revocada). La revocada solo la reactiva el Director desde la ficha.
- **Cambios de parámetros (9.6)**: un disparador en `parametros` registra cada cambio de valor de un parámetro que ya
  existía (`cap_cambios_parametro`), venga de Configuración o de una migración. Al procesarlo (al guardar en
  Configuración y en la tarea diaria):
  - Las preguntas que declaran ese parámetro quedan **en revisión** y no se sirven en quizzes, exámenes ni
    recertificaciones hasta que el Director confirma en Academia → Contenido que siguen correctas. Si la pregunta
    se corrige en el contenido (sube de versión), la revisión vieja deja de aplicar.
  - Si hay plantilla, se prepara la **microlección** con los valores nuevos y anteriores
    (`content/academia/microlecciones.json`: UMA, honorario, costo administrativo por alta, días de espera y plazos de
    ingreso/resolución). IVA y la base de reparto solo ponen preguntas en revisión (sin microlección).
  - La microlección se publica sola el día que entra en vigor el parámetro (el Director puede publicarla antes). Desde
    ahí hay `CAP_ACTUALIZACION_DIAS` (30) para aprobar su quiz de 5 preguntas (80%, intentos ilimitados con 1 h de
    espera). La deben tomar los asesores de pensiones que tenían alguna certificación al publicarse.
  - Sin aprobarla a tiempo, sus certificaciones vivas quedan **suspendidas** con origen «actualización»; al aprobarla
    se reactivan solas. La suspensión por línea roja tiene su propio origen y solo la levanta el Director.
  - Las preguntas de la microlección (con respuesta) no se conceden a ningún rol en la base; las lee el motor.
- **Repasos obligatorios (9.5)**: `CAP_GRAVES_UMBRAL` (2) incidencias graves en `CAP_GRAVES_DIAS` (90) crean un repaso
  del módulo ligado a cada tipo (promesa de monto, dato sensible, contraseñas → N0-02; documento rechazado y plazo
  prometido → R1-06; alerta ignorada → N0-04; queja → R1-07) con `CAP_REPASO_DIAS` (14). Se completa al aprobar el
  quiz de ese módulo. El plan no dice qué pasa si no se completa: por ahora solo se ve pendiente en la Academia y en
  la ficha del Director.
- **Alertas 12.3** en la tarea diaria (sin caso; en Hoy enlazan a la Academia): CAP_CERT_POR_VENCER y CAP_CERT_VENCIDA
  (persona y Director, una vez por certificación), CAP_SIN_AVANCE (`CAP_SIN_AVANCE_DIAS`, 7), CAP_ROLEPLAY_POR_EVALUAR
  (cualquier solicitud con más de `CAP_SOLICITUD_DIAS`, 3), CAP_ACTUALIZACION_PENDIENTE (días de
  `CAP_ACTUALIZACION_RECORDATORIOS`, 7,21,28; crítica el último), CAP_PREGUNTAS_REVISAR (Director) y CAP_METRICA_BAJA
  (una vez por semana). Si la parte de la Academia falla, las alertas de casos corren igual.

## 13-nov-2026 · Gerente de campo

Nuevo rol `campo` («Gerente de campo»): levanta prospectos en la calle (municipios, con módulo, banner y volantes).
Respuestas del Director: 1A, 2A, 3A, 4A.

- **Qué se paga (1A)**: solo los prospectos que el analista (rol asesor) o el Director **verifica**, es decir, datos
  reales, sin repetir y que contestó. «No contestó» suma un intento y lo deja pendiente. «No cuenta» lo rechaza con
  motivo y no se paga.
- **Pago por día (2A)**: un día cuenta cuando el gerente sube la foto del módulo (lugar y municipio) y el analista o el
  Director la aprueba. Hay una foto por día; si se la rechazan, puede subir otra ese mismo día. Las fotos van al bucket
  privado `campo`, en la carpeta del gerente.
- **Tarifa (3A)**: es la misma para todos los gerentes y se cambia en Configuración con vigencia. `CAMPO_PAGO_PROSPECTO`
  empieza en $20 y `CAMPO_PAGO_DIA` en $0, hasta que el Director lo defina. El monto queda guardado al verificar o
  aprobar, con la tarifa vigente el día en que se levantó el prospecto o se trabajó el día; si la tarifa cambia
  después, lo ya verificado no cambia.
- **Semana y pago (4A)**: la semana va de lunes a domingo y cuenta la fecha en que se **verificó o aprobó**. Se paga
  `CAMPO_DIAS_PARA_PAGO` (3) días después del domingo, es decir, el miércoles. El Director marca la semana como
  pagada en Prospectos de campo → Pagos, con referencia opcional, solo cuando la semana ya cerró. El pago guarda las
  cantidades y los montos, y liga cada prospecto y día. Solo el Director puede ligar un pago.
- **Separado de los clientes**: los prospectos del gerente viven en `campo_prospectos`. El gerente no ve clientes
  (personas ni casos) ni datos sensibles: solo captura nombre, WhatsApp, municipio y, si quiere, lugar, servicio,
  fecha de baja y notas. Al verificarlo, el analista crea la persona (origen `campo`) y el caso en «Prospecto», y puede
  asignarlo a un asesor de pensiones. Para pensión se exige P1, como en el resto.
- **Repetidos**: un WhatsApp que ya existe en clientes o en prospectos de campo vivos se rechaza al capturarlo, y otra
  vez al verificarlo.
- **Proyección del gerente**: su pantalla muestra «Por cobrar» (lo verificado sin pagar, por ejemplo
  100 × $20 = $2,000), «En revisión» (lo que cobraría si se verifica lo pendiente) y el próximo miércoles de pago.
- Si un gerente cambia de rol o se desactiva con dinero pendiente, sigue apareciendo en Pagos hasta que se le pague.
- **Pago por día variable (13-nov)**: `CAMPO_PAGO_DIA` queda en $250 como valor base. Como el pago depende de la
  ubicación, el Director escribe el monto de cada día al aprobar la foto; el campo trae la tarifa base. El analista
  aprueba con la tarifa base. Mientras la semana no se pague, el Director puede corregir el monto de cada día aprobado
  en Pagos de campo; la bitácora guarda el cambio. Lo que ya se pagó no se puede cambiar.
- **Tarifa por prospecto (13-nov)**: `CAMPO_PAGO_PROSPECTO` sube a $25; todavía no había prospectos, así que se
  ajustó el valor inicial. El Director cambia las tarifas (por prospecto y base por día) desde el recuadro «Tarifas»
  en Pagos de campo, con fecha «desde», con la misma regla de vigencia que Configuración. Cada prospecto se paga con
  la tarifa vigente el día en que se levantó.
