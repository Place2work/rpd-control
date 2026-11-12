# Academia RPD — Plan de capacitación de vendedores

**Retiro por desempleo y pensiones · RetiroPorDesempleo.com**
Versión 1.0 · 12 de noviembre de 2026 · Responsable: Irving Ortega Valois (Director)

---

## 0. Cómo usar este documento con Claude Code

Este documento es la **extensión del sistema RPD Control** para formar, evaluar y certificar
vendedores. Va junto a la especificación ya existente (`docs/ESPECIFICACION.md`).

1. Guárdalo en el repositorio como **`docs/CAPACITACION.md`**.
2. Agrega al `CLAUDE.md` del repositorio la línea:
   *"El módulo Academia se rige por docs/CAPACITACION.md. Las reglas de negocio de
   capacitación (secciones 3, 9 y 10) son fuente de verdad igual que ESPECIFICACION.md."*
3. Pide la implementación **por fases** con los prompts de la sección 13.

Partes del documento:

| Parte | Secciones | Para quién |
|---|---|---|
| **A. Diseño del programa** | 1 a 4 | Irving y Claude Code: qué se enseña, en qué orden y qué habilita |
| **B. Contenido** | 5 a 8 | Contenido semilla que se carga al sistema: lecciones, banco de preguntas, casos prácticos, guiones |
| **C. Evaluación y desempeño** | 9 y 10 | Reglas de certificación, rúbricas, métricas |
| **D. Especificación técnica** | 11 a 14 | Modelo de datos, pantallas, alertas, fases, criterios de aceptación |

> **Regla para Claude Code:** todo número legal o comercial (UMA, semanas mínimas, porcentajes,
> plazos, honorarios, comisiones) que aparezca en lecciones o preguntas se **liga a la tabla
> `parametros`** de la especificación. Cuando el parámetro cambia, las preguntas que dependen de él
> se marcan para revisión (sección 9.6). Nunca se escriben a mano en el código.

---

# PARTE A — DISEÑO DEL PROGRAMA

## 1. Resumen ejecutivo

**Objetivo:** que un vendedor nuevo pueda, en 4 semanas, **detectar, precalificar y cerrar**
retiros por desempleo sin errores que le cuesten dinero o semanas al cliente; y en 8 semanas más,
**detectar y canalizar** casos de pensión (Ley 73, Ley 97, Modalidad 40/10, fallecimiento,
Infonavit, ISSSTE) para que el asesor los convierta en contrato.

**Principio rector:** la empresa vende **asesoría honesta**. El vendedor de RetiroPorDesempleo.com
es el único del mercado que le dice al cliente **lo que recibe y lo que pierde en semanas**. Un
vendedor que cierra un retiro que no le conviene al cliente hace más daño que uno que no vende.

**Cómo funciona en el sistema:**

- La capacitación vive en un módulo nuevo, **Academia**, dentro de RPD Control.
- Está dividida en **5 certificaciones** (N0, R1, R2, P1, P2). Cada una se gana con lecciones,
  exámenes, casos prácticos, juego de roles y acompañamiento en casos reales.
- **Cada certificación habilita funciones del CRM.** Un vendedor sin R1 no puede precalificar; sin
  R2 no puede trabajar retiros de clientes Ley 73; sin P1 no recibe prospectos de pensión. El
  control se aplica en el servidor y en la base de datos, no solo en la pantalla.
- Las certificaciones **vencen** (12 meses) y se **suspenden** si cambia un parámetro legal y el
  vendedor no toma la actualización, o si comete una falta de "línea roja".

**A quién aplica:** rol **Vendedor** (Juan Carvajal y futuros) y rol **Socio licenciatario**
(que además opera casos, por lo que requiere R1 + R2 como mínimo). El Asesor puede tomar las rutas
como repaso, sin efecto en sus permisos.

## 2. El rol del vendedor: qué hace y qué no

| El vendedor **SÍ** | El vendedor **NO** |
|---|---|
| Prospecta, da de alta y da seguimiento | Promete montos ("te van a dar $X") |
| Pregunta en el orden correcto (fecha de baja, régimen, si trabaja en gobierno) | Da asesoría legal ni opina sobre juicios |
| Precalifica con el asistente del sistema y explica el resultado | Calcula una pensión final ni entrega el plan de pensión (eso es del asesor/Director) |
| Muestra **monto estimado + semanas que se pierden**, siempre juntos | Pide, guarda o usa contraseñas de AforeWeb, IMSS Digital, Mi Cuenta Infonavit o e.firma |
| Explica el honorario con claridad (30% IVA incluido en retiro) | Altera, sugiere alterar o "acomoda" salarios, semanas o patrones |
| Pide documentos y verifica que vengan bien (color, vigencia, sin tachaduras) | Dice que el trámite es exclusivo, privilegiado o que el cliente no puede hacerlo solo |
| Firma el contrato con folio y registra la aceptación del aviso de privacidad | Recibe dinero del cliente en su cuenta personal |
| **Dice "no te conviene"** cuando el sistema marca `CALIFICA_NO_CONVIENE` y ofrece la asesoría de pensión | Cotiza un porcentaje sobre una pensión mensual |
| Canaliza al asesor o al abogado los casos fuera de su certificación | Cita sentencias de la Corte como si fueran regla de ventanilla |

## 3. Rutas, certificaciones y lo que habilitan

### 3.1 Mapa de rutas

```
N0 Inducción (obligatoria para todos)
 │
 ├── R1 Vendedor de retiro ──→ R2 Retiro avanzado (Ley 73, impacto y desvíos)
 │                                   │
 └───────────────────────────────────┴──→ P1 Detección de pensiones ──→ P2 Especialista en pensiones
                                         (requiere R2)                  (requiere P1 + práctica)
```

> **Por qué P1 exige R2:** el vendedor de pensiones necesita entender exactamente cómo un retiro
> le quita semanas a un futuro pensionado. Sin eso, no sabe detectar el caso más valioso de la
> empresa: el cliente Ley 73 al que hay que decirle "no retires, planea tu pensión".

### 3.2 Requisitos y permisos por certificación

| Clave | Nombre | Requisitos para obtenerla | Habilita en el CRM (permisos) | Vigencia |
|---|---|---|---|---|
| `N0` | Inducción | 4 módulos + quiz ≥ 80% + acuse firmado del Código de conducta y del aviso de privacidad interno | `prospecto.crear`, `prospecto.nota`, `prospecto.seguimiento`, `whatsapp.plantillas`. Modo **aprendiz**: ve la precalificación en modo lectura | Sin vencimiento mientras esté activo |
| `R1` | Vendedor de retiro | N0 + 7 módulos + examen ≥ 80% con **100% en preguntas críticas** + 4 casos prácticos + juego de roles ≥ 80% sin criterio eliminatorio + **3 casos acompañados** (shadowing) | `precalificacion.retiro` (regímenes `L97` y `por_definir`), `contrato.retiro.generar`, `documentos.solicitar`, comisión de vendedor en retiro | 12 meses |
| `R2` | Retiro avanzado | R1 + 2 módulos + examen ≥ 85% (100% críticas) + 3 casos prácticos de impacto + juego de roles RP-03 + **2 casos Ley 73 acompañados** | `precalificacion.retiro.L73`, `analisis_impacto.borrador` (el asesor lo valida), `caso.desvio.crear` | 12 meses |
| `P1` | Detección de pensiones | R2 + 6 módulos + examen ≥ 85% (100% críticas) + 4 casos prácticos + 2 juegos de roles (viudez y M40) | `prospecto.pension.recibir`, `diagnostico_inicial.capturar` (checklist de pensión, fallecimiento, DSSV, ISSSTE), comisión de vendedor en servicios de pensión | 12 meses |
| `P2` | Especialista en pensiones | P1 + 2 módulos + examen ≥ 90% + **10 diagnósticos iniciales validados** por el asesor sin corrección grave + entrevista con el Director | `plan_pension.presentar` (junto con el asesor), `fallecimiento.integrar_expediente`, asignación de casos complejos | 12 meses |

**Reglas de permisos (para el código):**

- `tienePermiso(usuario, permiso, hoy)` = el rol del usuario lo permite **y** tiene una
  certificación `vigente` que habilita ese permiso. Se evalúa en el servidor (Server Actions) y en
  RLS mediante una vista `v_permisos_usuario`.
- Si el vendedor con R1 captura un régimen `L73` en la precalificación, el asistente **no muestra
  el resultado comercial**: crea una tarea "Revisión de asesor — Ley 73" y le explica por qué.
- Un caso iniciado por un vendedor no certificado para ese servicio se **reasigna** al asesor; el
  vendedor queda como `owner_id` (quien lo trajo). Si cobra comisión o no queda como decisión
  pendiente (sección 14).
- El Director puede otorgar una **excepción temporal** (máx. 30 días) con motivo; queda en bitácora.

## 4. Calendario del programa

Pensado para un vendedor de medio tiempo. Cada semana combina estudio en el sistema, práctica con
casos ficticios y trabajo real acompañado.

| Semana | Ruta | Horas de estudio | Práctica | Hito |
|---|---|---|---|---|
| 1 | **N0** Inducción | 6 h | Recorrido guiado del CRM con datos de prueba | Certificación N0 · empieza a prospectar en modo aprendiz |
| 2 | **R1** módulos R1-01 a R1-04 | 8 h | Casos prácticos C-R01 a C-R04 en el simulador | Quiz por módulo |
| 3 | **R1** módulos R1-05 a R1-07 | 6 h | Juego de roles RP-01 y RP-02 con el Director; 3 casos acompañados | Examen R1 · **certificación R1** |
| 4 | **R2** | 6 h | Casos C-R05 a C-R07; 2 casos Ley 73 acompañados | Examen R2 · **certificación R2** |
| 5–6 | **P1** módulos P1-01 a P1-03 | 10 h | Casos C-P01 a C-P03 | Quiz por módulo |
| 7–8 | **P1** módulos P1-04 a P1-06 | 10 h | Casos C-P04 a C-P06; juegos de roles RP-04 y RP-05 | Examen P1 · **certificación P1** |
| 9–20 | Práctica | — | 10 diagnósticos iniciales reales validados | — |
| ~20 | **P2** | 6 h | Entrevista con el Director | **Certificación P2** |

Coaching continuo: revisión semanal de 30 minutos con el Director usando el tablero de desempeño
(sección 10).

---

# PARTE B — CONTENIDO

Cada módulo se carga como una lección en Markdown (`content/academia/{ruta}/{clave}.md`) con
esta estructura: **objetivos · lo que tienes que saber · lo que dices · lo que nunca dices ·
práctica · fuente**. Lo que sigue es el contenido semilla; Claude Code lo copia a esos archivos.

## 5. Módulos

### 5.1 Ruta N0 — Inducción

#### N0-01 · La empresa, el servicio y cómo ganamos dinero (60 min)

**Objetivos:** explicar en 30 segundos qué hace la empresa; conocer el catálogo de servicios,
honorarios y su propia comisión.

**Lo que tienes que saber**

- **RetiroPorDesempleo.com** es una firma de asesoría con sede en Cuernavaca (Blvd. Gustavo Díaz
  Ordaz No. 49, Interior D-3, Col. Acapantzingo). Marca registrada. Contacto: 800 611 1245 ·
  WhatsApp 56 6474 9567 · hola@retiropordesempleo.com · L-V 9:00-18:00, S 9:00-14:00.
- **Qué vendemos:** asesoría, cálculo, estrategia, expediente correcto a la primera y
  acompañamiento. **No** vendemos acceso privilegiado: el trámite ante la Afore es gratuito y
  personal.
- **Nuestro diferenciador:** le decimos al cliente **lo que recibe y las semanas que pierde**. Los
  gestores informales no lo hacen.
- **Nunca prometemos un monto.** Todo cálculo es un **estimado** hasta que la Afore paga.
- **Catálogo de servicios** (tabla `tipos_servicio`): retiro por desempleo · asesoría de pensión
  Ley 73 · Ley 97 · Modalidad 40 · incorporación voluntaria (M10/PTI) · fallecimiento (viudez y
  recuperación de saldos) · devolución de vivienda Infonavit · corrección de NSS / semanas.
- **Hacia dónde va la empresa:** la línea prioritaria es la **asesoría de pensión Ley 73**, porque
  aporta más valor. Los retiros se hacen preferentemente a clientes **Ley 97** o a quienes **no
  les afecta** su futura pensión.
- **Honorarios:** retiro = **30% de lo que paga la Afore, IVA incluido**, sin monto mínimo de
  retiro. Pensión y demás servicios = **honorario fijo** que define la Dirección por caso.
- **Tu comisión** (esquema vigente en `esquemas_comision`): retiro = **5% del monto que paga la
  Afore**; fallecimiento = $3,000 del pago inicial + 5% de lo recuperado + $3,000 de la primera
  mensualidad; pensiones y otros = por definir. La comisión nace **estimada** al firmar, se
  **devenga** cuando entra el dinero y se cobra el honorario, y se **paga** al liquidarla. Nunca se
  paga sobre dinero que no ha entrado. En modalidad B se devenga por mensualidad.
- **Programa de referidos** (para que se lo expliques a clientes y conocidos): $1,000 por referido
  con honorario cobrado; $2,000 c/u si suma 3 a 10 en el mes; $3,000 c/u si suma más de 10.

**Ejemplo que debes saber hacer de memoria:** la Afore deposita $10,000 → honorario $3,000 (subtotal
$2,586.21 + IVA $413.79) → tu comisión $500.

**Fuente:** `docs/ESPECIFICACION.md` secciones 2 y 9.

#### N0-02 · Código de conducta, privacidad y líneas rojas (60 min)

**Objetivos:** conocer las conductas que suspenden la certificación y manejar datos personales
conforme a la LFPDPPP.

**Líneas rojas** (una sola falta = suspensión inmediata de certificaciones y revisión con el
Director; se registra en `cap_incidencias` con severidad `linea_roja`):

1. Prometer un monto o una fecha de pago como garantizados.
2. Pedir, anotar o guardar contraseñas de portales de terceros o la e.firma del cliente.
3. Sugerir, aceptar o facilitar la alteración de salarios, semanas o patrones ficticios.
4. Recibir dinero del cliente en una cuenta personal o en efectivo sin recibo de la empresa.
5. Declarar o dejar que el cliente declare desempleo estando empleado (incluido el gobierno).
6. Ocultar el costo en semanas o presentar el monto sin las semanas.
7. Decir que el trámite es exclusivo o que el cliente no puede hacerlo solo.
8. Compartir datos o documentos de un cliente fuera del sistema (grupos de WhatsApp, correo
   personal, fotos en el carrete del teléfono después de subirlas).

**Privacidad (LFPDPPP — ley de particulares, la que nos aplica):**

- Antes de pedir NSS, CURP o documentos, el cliente acepta el **aviso de privacidad** vigente; el
  sistema registra versión y fecha.
- Los documentos se suben **directo al sistema** desde la cámara del celular y se borran del
  teléfono.
- El vendedor ve los datos sensibles **enmascarados** (NSS `•••••••1002`); es por diseño.
- Solicitudes de acceso, rectificación, cancelación u oposición (ARCO) se pasan al Director el
  mismo día.

**Lo que dices:** *"Tus datos solo se usan para tu trámite y se guardan en un sistema protegido.
Aquí tienes nuestro aviso de privacidad."*

**Práctica:** el vendedor firma en el sistema el **acuse del Código de conducta** (`cap_acuses`).

#### N0-03 · Conceptos base del sistema de pensiones (90 min)

**Objetivos:** hablar el idioma del IMSS y la Afore; identificar el régimen del cliente.

**Lo que tienes que saber**

| Concepto | Qué es, en una línea |
|---|---|
| NSS | Número de Seguridad Social, 11 dígitos. Un cliente puede tener **dos** (NSS duplicado) |
| CURP | De aquí sale fecha de nacimiento y sexo |
| SBC | Salario Base de Cotización: el salario diario con el que el patrón lo registró en el IMSS |
| UMA | Unidad de Medida y Actualización. 2026: **$117.31 diaria / $3,566.22 mensual** (vigente del 1-feb-2026 al 31-ene-2027) |
| Semanas cotizadas | Tiempo registrado en el IMSS. Se consultan en la **Constancia de Semanas Cotizadas** |
| Bimestres | El retiro modalidad A pide **12 bimestres**, no 104 semanas |
| Afore | Administra la cuenta individual. Hay 10. El portal AforeWeb lo opera Procesar |
| Subcuenta RCV | Retiro, Cesantía y Vejez: **de aquí sale el retiro por desempleo** |
| SAR 92 | Dinero del Seguro de Retiro anterior; **no** entra en el 11.5% |
| Subcuenta de Vivienda | Infonavit. **No entra** en el retiro por desempleo y no se toca |
| Aportaciones voluntarias | Se pueden retirar en cualquier momento **sin perder semanas** |
| Estado de cuenta Afore | Única prueba de la fecha del último retiro |

**⛔ La primera pregunta de todo tema de pensión: ¿Ley 73 o Ley 97?**

| | Ley 73 | Ley 97 |
|---|---|---|
| Quién | Cotizó al menos un día **antes del 1 de julio de 1997** | Primera alta **desde el 1 de julio de 1997** |
| Semanas mínimas | **500** (no cambian nunca) | **875 en 2026**, +25 por año hasta 1,000 en 2031 |
| Quién paga | El IMSS, con fórmula (promedio de las últimas 250 semanas) | Sale de la cuenta individual |
| Le sirve M40 | **Sí, es su mercado** | Poco |

**Segunda pregunta obligatoria:** *"¿Trabaja hoy en el gobierno o en alguna dependencia? ¿A qué
institución le descuentan en su nómina?"* Quien cotiza hoy al ISSSTE **no está desempleado**.

**Fuente:** `claude/marco-legal-retiro-desempleo.md` sección 0; `claude/issste-y-portabilidad.md`
sección 0.

#### N0-04 · El sistema RPD Control para vendedores (60 min, práctico)

**Objetivos:** operar el CRM desde el celular.

- **Alta rápida** (menos de 30 segundos): nombre, WhatsApp, servicio de interés, fecha de baja si la
  sabe, origen y referidor. El sistema avisa si el teléfono, CURP o NSS ya existe.
- **Etapas del retiro:** Prospecto → Precalificado → (En espera) → Contrato → Armando expediente →
  Ingresada → Resolución → Pagado → Honorario cobrado. Bloqueado y Perdido son estados aparte con
  motivo obligatorio.
- **Alertas que te llegan:** `PROSPECTO_SIN_CONTACTO` (24 h sin evento), `PROSPECTO_FRIO` (14
  días), `DIA46_PROXIMO` y `DIA46_HOY`. Se atienden, posponen o descartan con motivo.
- **Plantillas de WhatsApp:** bienvenida y aviso de privacidad, documentos pendientes, faltan N días,
  ya puedes retirar, solicitud de referidos.
- **Tu estado de cuenta de comisiones:** estimadas, devengadas y pagadas.

**Práctica:** recorrido guiado con un prospecto ficticio hasta la alerta del día 46 (ambiente de
pruebas).

---

### 5.2 Ruta R1 — Vendedor de retiro

#### R1-01 · El derecho: artículo 191-II LSS (60 min)

**Lo que tienes que saber — las 5 condiciones antes de prometer nada:**

1. **Día 46 natural** desde que quedó desempleado. Criterio de la casa: `fecha de baja + 46 días`.
   Baja el 1-oct-2026 → puede pedirlo el **16-nov-2026**.
2. **Antigüedad de la cuenta** (no del trabajador): 3 años para modalidad A, 5 para B. La
   antigüedad cuenta toda la historia, también la anterior a 2009 (Transitorio Segundo, DOF
   26-05-2009). Un cliente con cuenta vieja califica aunque crea que no.
3. **12 bimestres** de cotización en la cuenta (modalidad A).
4. **Sin retiros en los 5 años previos**, acreditado con estados de cuenta de la Afore.
5. **La elección A o B es del trabajador**, y la ley le permite irse por A aunque califique a B.

**Modalidades**

| | Modalidad A | Modalidad B |
|---|---|---|
| Requisito | Cuenta con 3+ años **y** 12+ bimestres | Cuenta con 5+ años |
| Monto | 30 días del **último SBC**, tope **10 UMA mensuales = $35,662.20** (2026) | Lo **menor** entre 90 días del SBC promedio de las últimas 250 semanas y el **11.5% del saldo RCV** |
| Pago | Una exhibición | Hasta **6 mensualidades** (la primera puede ser de 30 días de SBC). Si se reincorpora a trabajar, se suspenden las siguientes |

Ninguna modalidad paga más que el saldo RCV.

**Fuente:** art. 191-II LSS (texto vigente en `claude/marco-legal-retiro-desempleo.md` sección 1).

#### R1-02 · Cómo se calcula (90 min)

**Orden de operaciones (el mismo del motor `lib/reglas/retiro.ts`):**

1. Modalidad A: `30 × SBC último`.
2. Aplicar tope de 10 UMA ($35,662.20). Se activa con SBC mayor a **$1,188.74 diarios**: arriba de
   eso, ganar más no aumenta el retiro.
3. Comparar contra el saldo RCV y pagar el menor.
4. Modalidad B: `menor(90 × SBC promedio 250 semanas, 11.5% × saldo RCV sin SAR 92)`.
5. Dividir el monto entre el saldo RCV → porcentaje que se retira → semanas que se pierden (R1-03).

**Trampas frecuentes**

- La **Circular CONSAR 31-10** (enero 2009) dice 75 días y 10%. **Está desactualizada**: la LSS se
  reformó en mayo de 2009 y dice **90 días y 11.5%**. Manda la ley.
- El **SBC promedio** no lo inventamos: viene en la **Certificación de Baja** del IMSS.
- **Salario alto con saldo bajo** casi siempre significa poco tiempo en el sistema formal: suele caer
  en B por el 11.5% y cobra mucho menos de lo que espera. Adviértelo antes.
- Puede haber **retención de ISR**: nunca prometas el neto exacto.

**Fuente:** reglas de la calculadora acordadas, tal como están en `docs/ESPECIFICACION.md`
sección 7.2.

#### R1-03 · El costo real: semanas que se pierden — art. 198 LSS (60 min)

**La fórmula, en este orden:**

```
cociente          = saldo RCV ÷ semanas cotizadas
semanas perdidas  = monto retirado ÷ cociente
semanas después   = semanas cotizadas − semanas perdidas
```

Ejemplo: saldo $100,000, 400 semanas, retira $15,000 → cociente $250 → pierde **60 semanas**
(15% del saldo) → le quedan 340.

- Las semanas **se pueden recuperar** reintegrando el dinero (proporcional). Las reglas de reintegro
  las emite CONSAR — **pendiente de fuente**: no expliques el procedimiento, solo que existe.
- No confundas dos cosas: las semanas que se **descuentan por el retiro** (art. 198) son distintas
  de las semanas viejas que **se reconocen al volver a cotizar** (art. 151).

**Lo que dices:** *"Puedes retirar hasta $15,000, estimado. A cambio se descuentan 60 de tus 400
semanas; te quedarías con 340. Esas semanas se pueden recuperar si después reintegras el dinero.
Nuestro honorario sería $4,500 con IVA incluido."*

**Lo que nunca dices:** *"No pierdes nada"*, *"las semanas no importan"*, o el monto sin las
semanas.

#### R1-04 · Leer los documentos del cliente (90 min)

**Constancia de Semanas Cotizadas**

- Cuenta **bimestres con aportación**, no semanas. Un historial fragmentado toca más bimestres con
  menos semanas.
- Muestra semanas **descontadas** por retiros, pero **no la fecha** del retiro. El candado de 5 años
  solo se verifica con el **estado de cuenta de la Afore** → mientras no lo tengas, el resultado es
  `APTO_BLOQUEADO`.
- Fecha de **primera alta** antes del 1-jul-1997 → Ley 73.
- **Constancia en ceros con NSS asignado** → tres sospechas: NSS duplicado, cotizó en el ISSSTE o
  nunca cotizó formalmente. Pregunta: *"¿Trabajaste con recibo de nómina? ¿En qué sector?"*
- Si aparece un **alta vigente** (cotiza actualmente) → no puede retirar todavía.

**Estado de cuenta de la Afore:** saldo RCV, SAR 92, vivienda (se muestra en otra columna desde el
primer contacto, nunca se suma), voluntarias y movimientos de retiros previos.

**Certificación de la Baja del Trabajador Desempleado (IMSS):** documento eje del trámite, va en
**original**, y trae el SBC promedio de 250 semanas.

**Práctica:** el simulador muestra constancias ficticias y el vendedor captura régimen, semanas,
bimestres, fecha de baja y si hay retiros previos.

#### R1-05 · Precalificación: preguntas en orden y los 6 resultados (90 min)

**Orden de preguntas en el primer contacto** (el asistente del CRM las hace en este orden):

1. ¿Cuándo te dieron de baja? (fecha exacta)
2. ¿Estás trabajando hoy, en una empresa o en el gobierno? ¿A qué institución te descuentan?
3. ¿Ya has retirado de tu Afore antes? ¿Cuándo?
4. ¿Empezaste a trabajar antes de julio de 1997? (régimen)
5. ¿Qué edad tienes? (55+ y Ley 73 → probable desvío a pensión)
6. ¿Tienes tu constancia de semanas y tu estado de cuenta de la Afore?
7. ¿Tienes aportaciones voluntarias?

**Los 6 resultados** (el sistema los evalúa en este orden; gana el primero que se cumple):

| # | Resultado | Qué significa | Qué haces |
|---|---|---|---|
| 1 | `NO_ELEGIBLE_DEFINITIVO` | Constancia en ceros sin explicación, o cuenta que no llega a 3 años sin posibilidad de completarla | Explicas por qué, agradeces y archivas con motivo |
| 2 | `NO_ELEGIBLE_DESVIO` | No califica al retiro pero sí a otro servicio (Ley 73 con 55+, NSS duplicado, voluntarias, M40/M10, Infonavit) | Ofreces el servicio sugerido; el sistema crea el caso |
| 3 | `NO_TODAVIA` | Cotiza hoy, o el día 46 o el candado de 5 años están en el futuro, o le faltan meses para los 3 años | Le das **la fecha** y queda en espera con alerta |
| 4 | `APTO_BLOQUEADO` | Todo cumple, pero falta verificar el último retiro, el IDE o la cuenta está "asignada" | Pides el documento o la cita que falta |
| 5 | `CALIFICA_NO_CONVIENE` | Califica, pero las semanas que pierde ponen en riesgo su pensión | **Le dices que no le conviene** y ofreces asesoría de pensión |
| 6 | `APTO` | Todo lo demás | Generas contrato |

**No hay monto mínimo de retiro para tomar un caso.** (La regla anterior de "no tomar si el retiro
es menor al honorario" ya no aplica.)

#### R1-06 · Expediente, portal y plazos (90 min)

**Checklist del retiro** (Regla 32ª Circular CONSAR 31-10 + práctica del portal):

| Documento | Lo que tumba el trámite |
|---|---|
| Certificación de baja del IMSS | Debe ir en **original** |
| Comprobante de registro en la Afore | Cuenta "**asignada**" (no registrada) no puede retirar |
| INE (o cédula, pasaporte, cartilla) | Vigente, legible |
| Comprobante de domicilio | **Máximo 3 meses** |
| Estado de cuenta de la Afore | Para el candado y el saldo |
| Constancia de semanas | — |
| Estado de cuenta bancario | Cuenta **nivel 4** a nombre del cliente. Las cuentas solo digitales (Nu, Mercado Pago) suelen fallar |
| Todo | Fotos **a color** desde el celular (mínimo 256 KB), sin tachaduras ni enmendaduras |

**El bloqueo más común: el IDE (Expediente de Identificación).** Sin biometría registrada el portal
no avanza y manda al cliente a cita presencial. La cita debe agendarse como **"Expediente de
Identificación (IDE)"**, no como "Retiro parcial por desempleo", o lo regresan.

**Plazos que le puedes decir al cliente (y ninguno más):**

- La firma ingresa la solicitud en un máximo de **15 días hábiles** desde que el expediente está
  **completo**.
- La Afore tiene **5 días hábiles** para resolver, según su acuse.
- El contrato vale **90 días naturales**; el conteo se **suspende** mientras falten documentos del
  cliente.
- **Nunca** prometas plazos más largos ni "en 30 días te paga": genera riesgo legal.

#### R1-07 · Proceso comercial: contacto, objeciones y cierre (120 min)

**Embudo del vendedor**

1. **Primer contacto en menos de 24 h** (si no, `PROSPECTO_SIN_CONTACTO`). La primera pregunta es la
   fecha de baja.
2. **Precalificación** con el asistente, con la constancia y el estado de cuenta en mano.
3. **Presentación del resultado**: modalidad A y B lado a lado, monto estimado, semanas que pierde,
   honorario y neto estimado. Se entrega la **hoja de precalificación en PDF**.
4. **Cierre:** contrato con folio `RP-####` (mismo número que el caso) + aviso de privacidad
   aceptado. Explicar: 90 días de vigencia, suspensión por documentos, alcance (no incluye asesoría
   legal; si se necesita abogado es un pago aparte).
5. **Expediente:** lista de documentos por WhatsApp con la plantilla.
6. **Seguimiento** hasta el pago y el cobro del honorario.
7. **Referidos:** al cerrar, plantilla "Solicitud de referidos".

**Fuentes de prospectos:** formulario web (llega con origen `web`), WhatsApp, llamada, referidos,
redes. Todo prospecto se registra en el sistema el mismo día; **no se llevan listas paralelas**.

Las objeciones y guiones están en la sección 8.

---

### 5.3 Ruta R2 — Retiro avanzado

#### R2-01 · Retiro contra pensión: el análisis de impacto (90 min)

**Ley 97:** el mínimo de semanas depende del año en que el cliente cumple 60:
`mínimo = menor(1000, 750 + 25 × (año − 2021))` → 875 en 2026, 900 en 2027, 925 en 2028, 950 en
2029, 975 en 2030 y 1,000 desde 2031.

- Si el cliente tiene **55 años o más** y las semanas después del retiro quedan **debajo** del mínimo
  de su año → alerta **crítica** → `CALIFICA_NO_CONVIENE`.
- Si quedan **a menos de 50 semanas** del mínimo → aviso.

**Ley 73:** necesita 500 semanas; cada **52 semanas arriba de 500 es un incremento anual** de su
pensión (art. 167 LSS 1973). Fracciones: sobrante de 13 a 26 semanas = medio incremento; más de 26 =
uno completo.

- Ejemplo: 900 semanas → 400 arriba de 500 → 7 años (364) + 36 de sobrante (> 26) = **8
  incrementos**. Si el retiro le quita 30 → 870 → 7 años + 6 = **7 incrementos**: pierde uno, de por
  vida.
- Si las semanas después quedan debajo de **550** → alerta crítica.

**Regla de política que el sistema hace cumplir:** un retiro Ley 73 **no pasa a Contrato** sin
análisis de impacto registrado (semanas antes y después, incrementos o umbral) y la casilla "el
cliente recibió y entendió el costo en semanas". El vendedor R2 captura el borrador; el asesor lo
valida.

**El cliente más delicado:** Ley 73 con muchas semanas. Es el que más tiene que perder y el que más
se deslumbra con el dinero inmediato. Aquí la asesoría honesta muchas veces es **"no lo hagas"**, y
decirlo es lo que construye reputación y referidos.

#### R2-02 · Desvíos: lo que puedes ofrecer en lugar del retiro (60 min)

| Si detectas… | Ofreces… |
|---|---|
| Necesita liquidez pero no puede perder semanas | Revisar **aportaciones voluntarias**: se retiran sin costo en semanas (art. 192) |
| Ley 73, 55+ años, o cerca de pensionarse | **Asesoría de pensión** (ruta P) |
| Recién dado de baja, Ley 73, menos de 5 años de la baja | **Modalidad 40** (ruta P) |
| Recién dado de baja con padecimiento crónico | **Incorporación voluntaria (M10)** dentro de 12 meses (ruta P) |
| NSS duplicado o semanas que no aparecen | **Corrección de NSS / semanas** |
| Retiró por matrimonio hace años y sus semanas siguen descontadas | Reclamar la **reintegración** (Transitorio Sexto, DOF 26-05-2009) |
| Pensionado que nunca usó crédito Infonavit | **Devolución de vivienda** |

**Preguntas frecuentes del recién desempleado:**

- *"¿Me quedo sin seguro médico?"* — Si tenía al menos 8 semanas cotizadas seguidas antes de la baja,
  conserva **8 semanas** de atención médica, él y sus beneficiarios (art. 109 LSS).
- *"¿Pierdo mis semanas viejas si dejo de trabajar?"* — No. Al volver a cotizar se reconocen; según
  el tiempo fuera puede requerir 26 o 52 semanas nuevas (art. 151 LSS).
- *"¿Pierdo mi Infonavit?"* — El retiro no toca la subcuenta de vivienda.

---

### 5.4 Ruta P1 — Detección de pensiones

> **Alcance del vendedor P1:** detecta, hace el diagnóstico inicial con el checklist del sistema,
> explica las rutas en términos generales y agenda con el asesor. **No** calcula la pensión final ni
> entrega el plan.

#### P1-01 · Pensión Ley 73: cómo se arma y las decisiones irreversibles (120 min)

**Requisitos:** 500 semanas + 60 años (cesantía, además de quedar **sin trabajo remunerado**) o 65
(vejez). Invalidez: 150 semanas y dictamen médico del IMSS.

**Cómo se calcula (en concepto):** cuantía básica + incrementos anuales sobre el **salario promedio
de las últimas 250 semanas** (art. 167 LSS 1973). Por eso la Modalidad 40 funciona: sube ese
promedio.

**Cesantía se paga reducida (art. 171):**

| Edad | 60 | 61 | 62 | 63 | 64 | 65 (vejez) |
|---|---|---|---|---|---|---|
| % de la pensión de vejez | 75% | 80% | 85% | 90% | 95% | 100% |

Se suma un año cuando la edad pasa en 6 meses.

**🚨 La puerta de un solo sentido (art. 148):** firmar la cesantía **cierra para siempre** la
invalidez y la vejez. Un cliente de 63 años que firma cesantía se queda con el 90% de por vida.
Para un cliente de 60 a 64 con padecimiento crónico hay que comparar tres rutas **antes de firmar
nada**: cesantía ahora, invalidez (100%, depende de dictamen del IMSS — **nunca lo prometemos**) o
esperar a vejez.

**El piso (arts. 168 y 169):** ninguna pensión Ley 73 puede ser menor al piso. Para pensiones que se
otorgan en 2026 se trabaja con **$10,636.54 al mes**. Consecuencias:

- Si la cuantía calculada del cliente queda debajo del piso, **pensionarse a los 60 o a los 65 paga
  lo mismo** → la recomendación es los 60 (cumpliendo el requisito de quedar sin trabajo).
- Las asignaciones familiares (15% esposa, 10% por hijo) **no se suman encima del piso**: quedan
  dentro de él. No dejes que un gestor le cobre por "gestionar asignaciones" a alguien en el piso.
- El piso aplica a pensiones **otorgadas** ese año. Las pensiones en curso suben por inflación
  (INPC). **No prometas "nivelar" una pensión vieja al piso de hoy.**

**Conservación de derechos (art. 182 LSS 1973):** quien deja de cotizar conserva su derecho a
pensión por **¼ del tiempo cotizado** desde la baja, **mínimo 12 meses**. Si se vence antes de
cumplir 60, **no adquiere el derecho** (art. 280) hasta recuperar cotizando de nuevo. Es la
primera fecha que hay que calcular en todo cliente Ley 73 que no cotiza.

**Lo que dices:** *"Antes de firmar cualquier cosa en el IMSS, déjame que el asesor compare tus
rutas. Hay decisiones que no tienen regreso."*

**Fuente:** `claude/marco-legal-retiro-desempleo.md` secciones 0-bis y 0-ter;
`claude/piso-pension-ley-73.md`.

#### P1-02 · Pensión Ley 97 (60 min)

- Requisitos: semanas del año (875 en 2026) + 60 (cesantía) o 65 (vejez).
- La pensión sale de la **cuenta individual**: **renta vitalicia** (aseguradora, de por vida, no
  deja saldo) o **retiro programado** (el saldo se queda en la Afore y el remanente **sí** se
  hereda). Elegir entre las dos es, en el fondo, una decisión sobre herencia. Se puede pasar de
  retiro programado a renta vitalicia, no al revés.
- **Pensión garantizada** (art. 170): tabla por salario, edad y semanas. Los importes de la tabla
  son de **diciembre de 2020** y se actualizan cada febrero por inflación → **nunca cotices esos
  pesos tal cual**.
- Sin las semanas a los 60: puede **retirar su saldo en una exhibición** o seguir cotizando
  (art. 154).

#### P1-03 · Modalidad 40 y Modalidad 10 (120 min)

| | **Modalidad 40** (continuación voluntaria, arts. 218-221) | **Modalidad 10** (incorporación voluntaria, art. 13-I y 222-233) |
|---|---|---|
| Para quién | **Ley 73**, para subir el promedio de las últimas 250 semanas | Independientes; también para seguir sumando semanas |
| Entrada | 52 semanas en los últimos 5 años **y** solicitarla **dentro de 5 años** de la baja | Ser trabajador independiente |
| Servicio médico | **❌ No** | **✅ Sí**, con tiempos de espera |
| Se cae por | **2 meses sin pagar** (con 12 meses para reingresar) | No pagar las cuotas |

**M10 — la ventana de oro (art. 85 RACERF):** si se solicita **dentro de 12 meses** de la baja y
tenía **52 semanas** antes, **no hay** cuestionario médico, rechazo por enfermedad preexistente ni
tiempos de espera. Pasado el plazo, padecimientos como complicaciones de diabetes, insuficiencia
renal, cáncer o VIH impiden entrar (art. 82). **Pregunta la fecha de baja antes que la salud.**

**Tiempos de espera de M10 (art. 83):** parto **10 meses**; ciertas cirugías 1 año; cirugía
ortopédica 2 años. Aplican solo a ese padecimiento; lo demás está cubierto desde el inicio.

**Los tres errores que nunca cometes:**

1. Vender M40 a un cliente Ley 97.
2. Dejar que el cliente crea que M40 le da servicio médico (va por escrito).
3. No advertir que 2 meses sin pagar lo dan de baja (va firmado).

**Zona prohibida:** el tope de cotización y la pensión en **UMA contra salario mínimo** está en
litigio. **No proyectes ni prometas resultados en salarios mínimos.** Eso lo calcula el asesor con
el criterio vigente a la fecha.

**Lo que dices a la embarazada que quiere M10 para el parto:** *"El IMSS tiene 10 meses de espera
para parto en esta modalidad. Si te inscribes hoy, el parto no te lo cubren. Te lo dejo por
escrito."*

#### P1-04 · Fallecimiento, viudez y concubinato (120 min)

**Regla de oro:** cuando muere un asegurado Ley 73, lo más valioso casi nunca es lo que tenía en la
Afore: es la **pensión de viudez**, mensual y de por vida. Primero se revisa la pensión; después el
dinero.

**Lo que puede recuperar la familia:**

| Qué | Ante quién | Tipo |
|---|---|---|
| Pensión de viudez (90%) y orfandad (20% c/u; 30% si es huérfano de ambos) | IMSS | Mensual |
| Ramo de retiro (SAR 92 + Retiro 97) y voluntarias | Afore o Fondo de Pensiones para el Bienestar | Una exhibición |
| Vivienda (Fondo de Ahorro 72-92, Vivienda 92 y 97) si nunca usó crédito | Infonavit o Fondo Bienestar | Una exhibición, **exenta** |
| Ayuda de gastos de funeral (2 meses de salario mínimo) | IMSS | Una vez; piden la **factura original** de la funeraria |

**Requisitos de la viudez Ley 73:** el finado tenía **150 semanas** o era pensionado, la muerte no
fue riesgo de trabajo, **y** al morir seguía cotizando o estaba **dentro de su conservación de
derechos**. Si había dejado de cotizar hace mucho sin pensionarse, puede no proceder → caso para el
asesor y el abogado.

**⏰ Urgencia:** el derecho a la pensión no prescribe, pero **solo se pagan las mensualidades de los
últimos 12 meses** (art. 279). Cada mes sin solicitar es un mes que la viuda ya no cobra.

**La trampa del matrimonio tardío (art. 154 LSS 1973):** no hay viudez si murió antes de 6 meses de
matrimonio; o si se casó después de los 55 años de él o ya pensionado, **salvo que haya pasado un
año**. **Ninguna aplica si tuvieron hijos.**

**Concubinato:** el IMSS **no acepta** cartas del ayudante municipal ni actas ante notario. Pide
**sentencia de un Juzgado Familiar + el auto que la declara ejecutoriada** (pídanse juntas). Con el
titular **vivo** es un trámite de semanas y bajo costo; ya fallecido, es un juicio. **Con un hijo en
común**, el acta de nacimiento sustituye la prueba de los 5 años.

**Recomendación general (la decide el asesor con el cliente):** con hijos en común → casarse. Sin
hijos y sano → casarse. Sin hijos y enfermo grave → declaración judicial de concubinato ya, estando
vivo.

**Afore sin beneficiarios designados** → el dinero se reparte según el **art. 501 de la LFT**,
muchas veces con juicio. **Designar beneficiarios en la Afore es gratis, toma una hoja y es la
acción de mayor valor que puedes recomendar a cualquier cliente.**

**Finados que habrían cumplido 70:** su dinero de Afore y vivienda puede estar ya en el **Fondo de
Pensiones para el Bienestar**. No se pierde (imprescriptible), pero cambia la ventanilla. Verifica
antes de prometer.

**Lo que nunca dices:**

- *"Ya no piden los cinco años, lo dijo la Corte."* (El amparo AR 408/2025 viene de prensa y la
  ventanilla sigue pidiéndolos. Lo correcto: *"si se lo niegan por el tiempo, hay con qué pelearlo,
  con abogado y con plazos"*.)
- *"Su viudo no tiene derecho"* a un viudo Ley 73: probablemente sí, por la vía de amparo. Es caso del
  abogado.

**Política de la firma:** el depósito siempre llega a la cuenta de la viuda; nunca se cobra porcentaje
sobre la pensión mensual; lo que sea juicio lo lleva el abogado socio (Edgar) y se explica por
separado.

**Fuente:** `claude/fallecimiento-que-recupera-la-familia.md`; `claude/viudez-y-concubinato.md`.

#### P1-05 · Devolución de vivienda Infonavit (60 min)

**Gancho comercial:** *"¿Ya se pensionó? ¿Nunca usó su crédito Infonavit? Entonces tiene dinero ahí,
no caduca, y nadie se lo va a depositar si no lo pide."*

- **Quién califica:** pensionado por el IMSS (vejez, cesantía o invalidez ≥ 50%), con saldo de
  vivienda, **sin crédito Infonavit activo** y sin haber usado esos fondos.
- **Tres bolsas distintas:** Fondo de Ahorro 1972-1992, Vivienda 92, Vivienda 97. Pedir las tres.
- **Exenta de impuestos** (art. 36 Ley Infonavit). **Imprescriptible** (art. 37).
- **Edad 70:** sin haberla reclamado (y sin relación laboral activa) pasa al Fondo de Pensiones para el
  Bienestar, con mecanismo de devolución permanente y con intereses. **No se pierde.**
- En Ley 73 se entrega en **una sola exhibición**.
- **El trámite es gratuito y no requiere intermediarios.** Lo que vendemos es la **revisión
  previa**: el 90% de los rechazos son porque NSS, CURP y RFC **no coinciden exactamente** entre IMSS,
  Afore y banco, o porque el estado de cuenta bancario tiene **más de 2 meses**.

#### P1-06 · ISSSTE y portabilidad (60 min)

- **Quien trabaja hoy en el gobierno no está desempleado:** no hay retiro por desempleo ni del IMSS ni
  del ISSSTE. *"Si alguien le ofrece sacar su Afore mientras trabaja en el gobierno, es un fraude."*
- **Dos regímenes en el ISSSTE:** Décimo Transitorio ("ley vieja", no porta con el IMSS) y cuentas
  individuales (sí porta). Quien eligió el Bono en 2008 está en cuentas individuales para siempre.
- **Portabilidad:** se pueden sumar semanas IMSS y años ISSSTE al llegar a la edad de pensión
  (1 año = 52 semanas). Los periodos **simultáneos no se suman**. **No es automática: se solicita.**
- **Ojo (art. 144):** con 25 años **solo en el ISSSTE** le toca la garantizada del ISSSTE (más alta
  para salarios bajos y medios). Si completa los 25 con semanas del IMSS, le toca la del IMSS. La
  portabilidad es **red de seguridad**, no primera opción.
- **Servicio médico del pensionado mixto:** requiere 15 años en una institución o 24 en conjunto.

**Tu trabajo aquí:** detectar el caso y pasarlo al asesor con la Hoja Única de Servicios y la
constancia del IMSS que **genere el propio cliente**.

---

### 5.5 Ruta P2 — Especialista en pensiones

#### P2-01 · Pensiones con problemas: préstamos, negativas y correcciones (90 min)

**Descuentos por préstamos (Transitorio Vigésimo Noveno LSS):** el total de descuentos no puede
pasar de **30%** de la pensión, no puede dejarla debajo del **promedio de las pensiones garantizadas**
a 1 salario mínimo y 60 años, y el plazo no puede pasar de **60 meses**. Un pensionado que recibe
unos cientos de pesos por préstamos está probablemente debajo del piso legal → reclamación al IMSS y
queja en CONDUSEF (lo arma el asesor).

**Negativa de pensión:**

- **Recurso de inconformidad:** 15 días hábiles desde la notificación (art. 294 LSS). Ese plazo no se
  perdona → alerta inmediata al asesor.
- **Juicio:** Tribunal Laboral Federal del lugar de la clínica del asegurado. Lo firma y lleva el
  **abogado**; nosotros integramos expediente (art. 899-C LFT), calculamos y canalizamos.
- Siempre conseguir el **acuse sellado** de la solicitud (sirve para impugnar el silencio del IMSS).

**Corrección de pensiones mal calculadas — honestidad primero:** antes de ofrecer un "retroactivo",
el asesor revisa la hoja de cálculo de la resolución. Hay casos donde el IMSS calculó bien y la
pensión es baja porque subió por inflación y no por salario mínimo (criterio de la SCJN de 2024).
**No se presenta como probable lo que solo se gana en juicio con riesgo alto.**

#### P2-02 · Diagnóstico integral y presentación del plan (120 min)

**Preguntas obligatorias en todo diagnóstico de pensión** (checklist del sistema):

1. Régimen, semanas totales (cotizadas − descontadas + reintegradas), fecha de primera alta.
2. Fecha de nacimiento → fechas de 60 y 65.
3. Fecha de última baja → conservación de derechos, plazo de M40 (5 años), ventana M10 (12 meses).
4. ¿Trabaja hoy? ¿Formal, independiente, gobierno?
5. Estado de salud (para comparar invalidez — sin prometer dictamen).
6. **Estado civil: casado o unión libre.** ¿Hijos en común? Edad de él al casarse.
7. **¿Designó beneficiarios en la Afore?**
8. ¿Tuvo crédito Infonavit? ¿Qué firmó al "traspasar" la casa? (una cesión ante notario no libera el
   crédito)
9. ¿Préstamos descontados de la pensión? (si ya es pensionado)
10. ¿Retiros previos de la Afore? ¿Aportaciones voluntarias?
11. ¿Cotizó alguna vez al ISSSTE?

**Presentación del plan (junto con el asesor):** comparativo de rutas (cesantía, invalidez, vejez,
M40, M10/PTI), lo que cuesta cada una, lo que deja a la familia y las fechas límite. Siempre se dice
**"estimado"**.

---

## 6. Banco de preguntas semilla

Formato para cargar (`content/academia/preguntas/*.yaml`): `clave`, `modulo`, `critica`,
`enunciado`, `opciones`, `correcta`, `explicacion`, `parametros` (claves de `parametros` de las que
depende). Las preguntas **críticas** deben contestarse bien al 100% para aprobar el examen de ruta.
Aquí van en formato legible; ✔ marca la correcta.

### N0

**N0-Q01** · crítica · Un cliente te pregunta si le garantizas que va a recibir $15,000. ¿Qué
respondes?
- a) "Sí, te lo garantizo."
- b) "Es un estimado; el monto final lo determina la Afore. Te enseño lo que recibirías y las semanas que pierdes." ✔
- c) "Seguro te dan más."
- d) "Eso no te lo puedo decir."
*Por qué:* nunca prometemos montos; todo cálculo es estimado y va con su costo en semanas.

**N0-Q02** · crítica · El cliente te manda su usuario y contraseña de AforeWeb "para agilizar".
- a) Los guardas en las notas del CRM.
- b) Los usas una vez y los borras.
- c) Le pides que no los comparta y que él capture en el portal; nunca se guardan ni usan contraseñas de terceros. ✔
- d) Se los reenvías al asesor.
*Por qué:* línea roja 2.

**N0-Q03** · crítica · Un prospecto te pide "subirle el salario" en su registro para retirar más.
- a) Le dices que lo consultas.
- b) Lo rechazas: la empresa no altera salarios ni crea patrones ficticios. ✔
- c) Lo canalizas con un gestor.
- d) Lo haces si paga más honorario.
*Por qué:* línea roja 3.

**N0-Q04** · ¿El trámite de retiro por desempleo ante la Afore tiene costo?
- a) Sí, lo cobra la Afore.
- b) Es gratuito y personal; nosotros cobramos por asesoría, cálculo, expediente y acompañamiento. ✔
- c) Solo es gratuito si lo hace una firma.
*Por qué:* así se vende sin riesgo frente a PROFECO y CONDUSEF.

**N0-Q05** · crítica · ¿Cuál es la primera pregunta de diagnóstico en cualquier tema de pensión?
- a) ¿Cuánto dinero quiere?
- b) ¿Cotizó antes del 1 de julio de 1997? (Ley 73 o Ley 97) ✔
- c) ¿En qué Afore está?
*Por qué:* si se equivoca el régimen, todo lo demás sale mal.

**N0-Q06** · El honorario del retiro por desempleo es:
- a) 26% más IVA.
- b) 30% de lo que paga la Afore, IVA incluido. ✔ `parametros: HONORARIO_RETIRO_PCT, IVA`
- c) Una cuota fija.

**N0-Q07** · ¿Qué subcuenta NO entra en el cálculo del retiro?
- a) RCV.
- b) Vivienda. ✔
- c) Ninguna, entra todo.

**N0-Q08** · La Afore deposita $10,000. ¿Cuál es tu comisión con el esquema estándar?
- a) $300.
- b) $500. ✔ `parametros: COMISION_VENDEDOR_RETIRO_PCT`
- c) $3,000.
*Por qué:* 5% del monto que paga la Afore; se devenga cuando entra el pago y se cobra el honorario.

**N0-Q09** · Un cliente que trabaja en una dependencia de gobierno te dice que su constancia del
IMSS muestra baja en 2011. ¿Puede hacer retiro por desempleo?
- a) Sí, por la baja del IMSS.
- b) No: tiene relación laboral vigente. ✔
- c) Sí, si espera 46 días.

### R1

**R1-Q01** · crítica · Fecha de baja: 1 de octubre de 2026. ¿Desde qué fecha se puede solicitar el
retiro según el criterio de la casa?
- a) 16 de noviembre de 2026 ✔ `parametros: DIAS_ESPERA_DESEMPLEO`
- b) 1 de noviembre de 2026
- c) 15 de noviembre de 2026

**R1-Q02** · crítica · Requisitos de la modalidad A:
- a) Cuenta con 5 años.
- b) Cuenta con 3 años de abierta y 12 bimestres de cotización. ✔
- c) 104 semanas cotizadas.

**R1-Q03** · La modalidad B paga:
- a) 30 días del último SBC.
- b) Lo menor entre 90 días del SBC promedio de 250 semanas y el 11.5% del saldo RCV. ✔
- c) Lo mayor entre ambos.

**R1-Q04** · numérica · Califica solo a A. SBC último $500, saldo RCV $100,000. Monto estimado:
- respuesta: **15000** (tolerancia 0) `parametros: UMA_MENSUAL`

**R1-Q05** · numérica · Mismo cliente, 400 semanas. ¿Cuántas semanas pierde?
- respuesta: **60** (tolerancia 0.1)

**R1-Q06** · Califica a A con SBC último de $2,000 diarios. Monto estimado en 2026:
- a) $60,000
- b) $35,662.20 ✔ `parametros: UMA_MENSUAL`
- c) $30,000

**R1-Q07** · Un cliente califica a A y B. ¿Quién elige?
- a) La Afore.
- b) El trabajador; la ley le permite optar por A aunque califique a B. ✔
- c) Siempre se paga B.

**R1-Q08** · crítica · ¿Cómo se verifica que no haya retirado en los últimos 5 años?
- a) Con la constancia de semanas.
- b) Con el estado de cuenta de la Afore. ✔
- c) Preguntándole al cliente.
*Por qué:* la constancia muestra semanas descontadas pero no la fecha.

**R1-Q09** · La constancia muestra 41 semanas descontadas y no tienes el estado de cuenta. ¿Qué
resultado corresponde si todo lo demás cumple?
- a) `APTO`
- b) `APTO_BLOQUEADO` hasta verificar la fecha del último retiro. ✔
- c) `NO_ELEGIBLE_DEFINITIVO`

**R1-Q10** · Constancia en ceros con NSS asignado. ¿Qué investigas?
- a) Nada, se archiva.
- b) Posible NSS duplicado, cotización en ISSSTE o que nunca cotizó formalmente; preguntas si trabajó con recibo de nómina y en qué sector. ✔
- c) Que la Afore se equivocó.

**R1-Q11** · El portal bloquea al cliente por biometría. ¿Cómo se agenda la cita?
- a) Como "Retiro parcial por desempleo".
- b) Como "Expediente de Identificación (IDE)". ✔
- c) No se agenda; se espera.

**R1-Q12** · ¿Qué cuenta bancaria se pide?
- a) Cualquiera a nombre del cliente.
- b) Nivel 4, sin límite de depósitos, a nombre del cliente; las solo digitales suelen fallar. ✔
- c) La del vendedor.

**R1-Q13** · Antigüedad máxima del comprobante de domicilio:
- a) 6 meses
- b) 3 meses ✔
- c) 1 año

**R1-Q14** · ¿Qué documento debe ir en original?
- a) INE
- b) Certificación de la baja del IMSS ✔
- c) Comprobante de domicilio

**R1-Q15** · crítica · ¿Qué plazo de ingreso le prometes al cliente?
- a) "En 30 días ya tienes tu dinero."
- b) Ingresamos en máximo 15 días hábiles desde que el expediente está completo; la Afore tiene 5 días hábiles para resolver. ✔ `parametros: SLA_DIAS_HABILES, AFORE_DIAS_HABILES`
- c) "Mañana mismo."

**R1-Q16** · Un colega te enseña la Circular CONSAR 31-10 que dice "75 días y 10%". ¿Qué haces?
- a) Usas esos números.
- b) Aplicas la LSS reformada en mayo de 2009: 90 días y 11.5%. ✔
- c) Promedias.

**R1-Q17** · El 11.5% se calcula sobre:
- a) El saldo total de la cuenta.
- b) El saldo RCV sin SAR 92. ✔
- c) RCV más vivienda.

**R1-Q18** · El retiro estimado es de $2,500. ¿Se toma el caso?
- a) No, es menor al mínimo.
- b) Sí: no hay monto mínimo de retiro, siempre que le convenga al cliente. ✔
- c) Solo si paga honorario fijo.

**R1-Q19** · ¿Cómo se paga la modalidad B?
- a) En una exhibición.
- b) Hasta 6 mensualidades; si se reincorpora a trabajar, se suspenden las siguientes. ✔
- c) En 12 meses.

**R1-Q20** · ¿Las semanas descontadas por el retiro se pueden recuperar?
- a) No, nunca.
- b) Sí, reintegrando el dinero, de forma proporcional. ✔
- c) Sí, automáticamente al volver a trabajar.

### R2

**R2-Q01** · crítica · Ley 97, cumple 60 en 2028 (mínimo 925), tiene 950 semanas y el retiro le
quita 40. Resultado:
- a) `APTO`, porque tiene más de 925 hoy.
- b) `CALIFICA_NO_CONVIENE`: quedaría con 910, debajo del mínimo; se ofrece asesoría de pensión. ✔
- c) `NO_TODAVIA`

**R2-Q02** · Ley 73 con 900 semanas; el retiro le quita 30. ¿Qué pierde?
- a) Nada, sigue arriba de 500.
- b) Un incremento anual de su pensión (de 8 a 7), de por vida. ✔
- c) La pensión completa.

**R2-Q03** · crítica · ¿Cuántas semanas necesita un cliente **Ley 73** que se pensiona en 2026?
- a) 875
- b) 500 ✔
- c) 1,000

**R2-Q04** · El cliente necesita dinero pero no puede perder semanas. ¿Qué revisas primero?
- a) Un préstamo.
- b) Sus aportaciones voluntarias: se retiran sin costo en semanas. ✔
- c) La modalidad B.

**R2-Q05** · Cliente Ley 73 de 58 años quiere retirar. ¿Qué haces?
- a) Cierras el retiro.
- b) Lo desvías a asesoría de pensión: el sistema marca `NO_ELEGIBLE_DESVIO` o pide análisis de impacto. ✔
- c) Le dices que espere a los 60 para retirar.

**R2-Q06** · "¿Me quedo sin seguro médico?" (tenía 2 años cotizando seguidos)
- a) Sí, desde el día de la baja.
- b) Conserva 8 semanas de atención médica, él y sus beneficiarios. ✔
- c) Conserva 1 año.

### P1

**P1-Q01** · crítica · Cliente Ley 73 de 63 años con padecimiento crónico quiere firmar cesantía hoy.
¿Qué le adviertes?
- a) Nada, es su derecho.
- b) Que firmar cesantía cierra para siempre la invalidez y la vejez; antes hay que comparar las tres rutas. ✔
- c) Que mejor espere a los 70.

**P1-Q02** · La cesantía a los 60 paga:
- a) 100% de la vejez.
- b) 75% de la vejez. ✔
- c) 90% de la vejez.

**P1-Q03** · Cliente Ley 73 cuya cuantía calculada queda debajo del piso. ¿A qué edad conviene
pensionarse?
- a) A los 65, porque cobra más.
- b) A los 60: en el piso cobra lo mismo a los 60 que a los 65 (debe quedar sin trabajo remunerado). ✔
- c) Da igual cuándo.

**P1-Q04** · Pensionado en el piso con esposa y dos hijos menores. ¿Cobra asignaciones familiares
encima del piso?
- a) Sí, 35% más.
- b) No: las asignaciones quedan dentro del piso. ✔
- c) Solo la de la esposa.

**P1-Q05** · crítica · ¿La Modalidad 40 da servicio médico?
- a) Sí.
- b) No: solo invalidez y vida y RCV. Si necesita atención médica, la vía es M10. ✔

**P1-Q06** · crítica · ¿Qué pasa si el cliente de M40 deja de pagar 2 meses?
- a) Nada.
- b) Causa baja; tiene 12 meses para pedir el reingreso. ✔
- c) Pierde todas sus semanas.

**P1-Q07** · Plazo para solicitar M40:
- a) Cuando quiera.
- b) Dentro de 5 años desde la baja, con 52 semanas en los últimos 5 años. ✔
- c) Dentro de 12 meses.

**P1-Q08** · ¿A quién le conviene M40?
- a) A cualquiera.
- b) Principalmente a Ley 73, porque sube el promedio de las últimas 250 semanas. ✔
- c) Principalmente a Ley 97.

**P1-Q09** · Ventana para entrar a M10 sin examen médico ni tiempos de espera:
- a) 5 años desde la baja.
- b) 12 meses desde la baja, con 52 semanas previas. ✔
- c) No existe.

**P1-Q10** · crítica · Una mujer embarazada quiere inscribirse a M10 para que le atiendan el parto.
- a) Le dices que sí la cubren.
- b) Le adviertes que el parto tiene 10 meses de espera y se lo dejas por escrito. ✔
- c) Le recomiendas M40.

**P1-Q11** · La pensión de viudez Ley 73 es:
- a) 50% de la pensión del finado.
- b) 90%. ✔
- c) 100%.

**P1-Q12** · crítica · Para acreditar concubinato, el IMSS pide:
- a) Carta del ayudante municipal.
- b) Acta ante notario con dos testigos.
- c) Copia certificada de la sentencia del Juzgado Familiar y del auto que la declara ejecutoriada. ✔

**P1-Q13** · ¿Qué efecto tiene un hijo en común en la viudez?
- a) Ninguno.
- b) Sustituye la prueba de 5 años de concubinato y anula las limitaciones del art. 154. ✔
- c) Solo sirve para la orfandad.

**P1-Q14** · Pensionado Ley 73 de 62 años, sin hijos con su pareja, se casa hoy. ¿Desde cuándo queda
protegida la viudez?
- a) Desde hoy.
- b) Cuando cumplan 1 año de casados. ✔
- c) A los 6 meses.

**P1-Q15** · crítica · El esposo murió hace 3 años y la viuda nunca pidió la pensión. ¿Qué le dices?
- a) Que ya prescribió.
- b) Que el derecho no prescribe pero solo se pagan los últimos 12 meses: hay que solicitar ya. ✔
- c) Que le pagan los 3 años completos.

**P1-Q16** · El finado no designó beneficiarios en su Afore. ¿Qué pasa con el saldo?
- a) Se pierde.
- b) Se entrega según el orden del art. 501 LFT, muchas veces con juicio. ✔
- c) Se queda la Afore.

**P1-Q17** · Devolución de vivienda: ¿qué pasa si el pensionado cumple 70 sin reclamarla?
- a) La pierde.
- b) Pasa al Fondo de Pensiones para el Bienestar; no se pierde y se puede reclamar con intereses. ✔
- c) Se queda el Infonavit.

**P1-Q18** · ¿La devolución de vivienda paga ISR?
- a) Sí, 10%.
- b) No, está exenta. ✔

**P1-Q19** · ¿Cuál es el filtro que más clientes descarta en la devolución de vivienda?
- a) La edad.
- b) Tener crédito Infonavit activo o haber usado los fondos en un crédito. ✔
- c) La Afore.

**P1-Q20** · ¿Se suman los periodos en que cotizó al IMSS y al ISSSTE al mismo tiempo?
- a) Sí, cuentan doble.
- b) No, el tiempo simultáneo no se suma. ✔

**P1-Q21** · crítica · Una señora te dice: "Me dijeron que la Corte ya quitó los 5 años de
concubinato." ¿Qué respondes?
- a) "Sí, ya no los piden."
- b) "En ventanilla los siguen pidiendo; si se lo niegan por el tiempo, hay con qué pelearlo, con abogado y con plazos." ✔
- c) "Eso es falso."

**P1-Q22** · ¿Qué modalidad de pensión Ley 97 deja saldo heredable?
- a) Renta vitalicia.
- b) Retiro programado. ✔

### P2

**P2-Q01** · crítica · El IMSS notificó una negativa. ¿Cuál es el plazo del recurso de inconformidad?
- a) 15 días hábiles desde la notificación. ✔
- b) 2 años.
- c) No hay plazo.

**P2-Q02** · ¿Quién firma y lleva la demanda contra el IMSS?
- a) El vendedor.
- b) El abogado; la firma integra el expediente y canaliza. ✔

**P2-Q03** · Pensionado desde 2013 cobra menos que el piso de 2026 y quiere que se lo "nivelen".
- a) Le prometes el retroactivo.
- b) Le explicas que el piso aplica a pensiones otorgadas ese año y las demás suben por inflación; el asesor y el abogado revisan si hay algo que reclamar, sin prometer. ✔

**P2-Q04** · Límite legal de descuentos por préstamos sobre una pensión:
- a) 50% y sin plazo.
- b) 30% en total, sin dejarla debajo del piso de garantizadas, y plazo máximo de 60 meses. ✔

---

## 7. Casos prácticos (simulador)

Los casos usan **datos ficticios**. Nunca se cargan datos reales de clientes a la Academia. Cada caso
guarda `datos_entrada` y `resultado_esperado`; **el resultado esperado se valida contra el motor
`lib/reglas/`** en las pruebas (sección 14), así el contenido de capacitación y el sistema nunca se
contradicen. Parámetros: UMA mensual $3,566.22, honorario 30%, IVA 16%, `hoy` = 2026-11-12 salvo
que se diga otra cosa.

### Ruta R

| Clave | Situación | Lo que debe contestar el vendedor |
|---|---|---|
| **C-R01** | Ley 97, cuenta de 4 años, 20 bimestres, SBC último $500, saldo RCV $100,000, 400 semanas, baja hace 60 días, sin retiros (estado de cuenta en mano) | `APTO`. Solo A: **$15,000**. Pierde **60.0** semanas (quedan 340, 15% del saldo). Honorario $4,500 (subtotal $3,879.31 + IVA $620.69). Comisión $750 |
| **C-R02** | Ley 97, cuenta de 4 años, 30 bimestres, SBC $2,000, saldo $300,000, 600 semanas | A topada en **$35,662.20**. Pierde **71.3** semanas |
| **C-R03** | Ley 97, cuenta de 12 años, SBC último $650, promedio 250 semanas $600, saldo RCV $180,000, 820 semanas | A = **$19,500** (pierde **88.8**). B = menor($54,000; $20,700) = **$20,700** (pierde **94.3**). Diferencia < 20% → el sistema resalta A por costar menos semanas. El vendedor presenta ambas y explica que la ley le permite elegir A |
| **C-R04** | 24 años, Ley 97, 115 semanas, alta vigente desde hace 5 días | `NO_TODAVIA`: cotiza actualmente. Si deja el empleo, podrá pedirlo 46 días después de la baja |
| **C-R05** | Ley 97, 58 años (60 en 2028, mínimo 925), 950 semanas, el retiro le quitaría 40 | `CALIFICA_NO_CONVIENE`. Guion "no te conviene" + oferta de asesoría de pensión |
| **C-R06** | Ley 73, 900 semanas, el retiro le quitaría 30 | Pierde 1 incremento (8 → 7). Requiere análisis de impacto; R2 captura borrador y explica |
| **C-R07** | Todo cumple pero la constancia muestra semanas descontadas y no hay estado de cuenta | `APTO_BLOQUEADO`: tarea "verificar último retiro en estado de cuenta de la Afore" |
| **C-R08** | 45 años, en el ISSSTE desde 2010, baja IMSS en 2011, 316 semanas IMSS | No hay retiro: tiene relación laboral. Detectar como posible caso de portabilidad (P1) |
| **C-R09** | Último retiro 15-mar-2022, todo lo demás cumple | `NO_TODAVIA`, fecha de elegibilidad **15-mar-2027** |

### Ruta P

| Clave | Situación | Lo que debe contestar el vendedor |
|---|---|---|
| **C-P01** | Ley 73, 654 semanas, 59 años, salario promedio bajo (cuantía calculada ≈ $3,249/mes) | Está en el piso: a los 60 cobra lo mismo que a los 65 → planear pensión a los 60 cumpliendo "sin trabajo remunerado". Asignaciones no suman. Pregunta urgente: estado civil (la viudez se calcula sobre el piso) |
| **C-P02** | Ley 73, 56 años, 1,093 semanas, sin cotizar desde hace casi 14 años, trabaja como independiente | Conservación de derechos vencida (¼ de 1,093 semanas ≈ 5 años) → debe volver a cotizar para recuperar derechos (52 semanas tras más de 6 años fuera). M40 cerrada (más de 5 años de la baja) → evaluar M10/PTI. Revisar qué firmó al "traspasar" su crédito Infonavit. Pasar al asesor |
| **C-P03** | Recién dado de baja (3 meses), Ley 73, 61 años, con 52+ semanas en los últimos 5 años | Candidato a **M40** (dentro de 5 años). Advertir: sin servicio médico y baja con 2 meses sin pago. Si necesita médico, M10 dentro de la ventana de 12 meses |
| **C-P04** | Finado Ley 73, 834 semanas, dejó de cotizar a los 48, murió a los 73 sin pensionarse; acta de defunción dice "soltero" pero había esposa | Viudez probablemente **no procede** (conservación vencida antes de los 60) → abogado lo confirma. Sí se recupera Afore (posiblemente ya en Fondo Bienestar por haber cumplido 70) y vivienda. Corregir el estado civil del acta. Juicio de designación de beneficiarios si hace falta |
| **C-P05** | Pareja en unión libre 12 años, sin hijos, él Ley 73 pensionado con 66 años y enfermo grave | Urge declaración judicial de concubinato **estando vivo** (casarse hoy abre el plazo de 1 año del art. 154). Designar beneficiarios en la Afore. Canalizar al abogado |
| **C-P06** | Pensionado de 68 años, nunca tuvo crédito Infonavit | Devolución de vivienda: pedir las tres bolsas; revisar que NSS, CURP y RFC coincidan; estado de cuenta bancario de menos de 2 meses; exenta de ISR; antes de los 70 |
| **C-P07** | Pensionado recibe $900 de $6,000 por tres préstamos | Descuento mayor al 30% y debajo del piso: caso de reclamación (asesor) |

---

## 8. Guiones y manejo de objeciones

### 8.1 Guiones base

**G-01 · Primer contacto (retiro)**
> *"Hola {nombre}, soy {vendedor} de RetiroPorDesempleo.com. Te ayudamos a saber si puedes retirar
> de tu Afore por desempleo, cuánto te tocaría y —algo que casi nadie te dice— cuántas semanas
> pierdes. Para empezar, ¿en qué fecha te dieron de baja? ¿Y hoy estás trabajando en alguna empresa
> o en el gobierno?"*

**G-02 · Presentación del resultado (APTO)**
> *"Con tus documentos, puedes retirar hasta {monto}, estimado; el monto final lo determina la Afore.
> A cambio se descuentan {semanas} de tus {total} semanas y quedarías con {después}. Se pueden
> recuperar si después reintegras el dinero. Nuestro honorario es el 30% de lo que te deposite la
> Afore, con IVA incluido: {honorario} estimado. Te dejo la hoja con los números."*

**G-03 · No te conviene (`CALIFICA_NO_CONVIENE`)**
> *"Te voy a ser honesto: sí calificas, pero no te lo recomiendo. Con este retiro bajarías a {después}
> semanas y para pensionarte en {año} necesitas {mínimo}. Recibirías {monto} hoy, pero podrías perder
> tu pensión. Lo que sí te conviene es que planeemos tu pensión; te agendo con nuestro asesor."*

**G-04 · No todavía (`NO_TODAVIA`)**
> *"Todavía no puedes, pero ya tenemos la fecha: a partir del {fecha}. Te escribo unos días antes para
> tener tus documentos listos y que no pierdas tiempo."*

**G-05 · Concubinato con el titular vivo** (de `viudez-y-concubinato.md`)
> *"Usted y su señora no están casados. Si usted falta, ella tiene derecho al 90% de su pensión de por
> vida, pero el IMSS le va a pedir una sentencia de juez, y usted ya no va a poder declarar a su
> favor. Hoy, estando usted vivo, eso se resuelve más rápido y barato. Y si tuvieron hijos juntos,
> tráigame las actas."*

**G-06 · Gancho de vivienda**
> *"¿Ya se pensionó? ¿Nunca usó su crédito Infonavit? Entonces tiene dinero ahí, no caduca y no paga
> impuestos, pero nadie se lo deposita si no lo pide."*

**G-07 · Beneficiarios**
> *"Una pregunta que le hago a todos: ¿ya designó beneficiarios en su Afore, y con qué porcentajes? Es
> gratis, es una hoja, y le evita un juicio a su familia."*

### 8.2 Objeciones

| Objeción | Respuesta honesta | Nunca digas |
|---|---|---|
| "Eso lo puedo hacer yo solo, es gratis." | "Tienes razón, el trámite es gratuito y lo puedes hacer tú. Lo que nosotros hacemos es calcular cuánto te toca y cuántas semanas pierdes, revisar que tu expediente vaya bien a la primera y acompañarte hasta el depósito. Si prefieres hacerlo solo, te dejo la lista de documentos." | "Sin nosotros no te lo dan." |
| "¿Por qué 30%? Es mucho." | "Es sobre lo que realmente te deposita la Afore, con IVA incluido, y solo si te pagan. Incluye el cálculo, el expediente y el seguimiento." | Inventar descuentos no autorizados. |
| "Un gestor me cobra menos." | "Pregúntale cuántas semanas vas a perder. Nosotros te lo decimos por escrito antes de firmar." | Hablar mal de personas concretas. |
| "Me dijeron que me dan más." | "Te enseño el cálculo con tus datos; la ley pone un tope. Si alguien te promete más, pregúntale de dónde sale." | Subir el estimado para igualar. |
| "¿Cuándo me pagan?" | "Ingresamos en máximo 15 días hábiles desde que tu expediente está completo, y la Afore tiene 5 días hábiles para resolver." | Una fecha de depósito garantizada. |
| "¿Pierdo mi pensión?" | "Pierdes semanas, en proporción a lo que retiras. Te digo exactamente cuántas y si te afecta para pensionarte." | "No pierdes nada." |
| "¿Pierdo mi Infonavit?" | "No, el retiro no toca la subcuenta de vivienda." | — |
| "No quiero dar mis datos." | "Es entendible. Solo los usamos para tu trámite, en un sistema protegido; aquí está el aviso de privacidad. Sin tu constancia y estado de cuenta no te puedo dar un cálculo responsable." | Presionar. |
| "¿Me garantizas el monto?" | "No, y desconfía de quien te lo garantice. Te garantizo que vas a saber los números reales antes de firmar." | "Sí." |
| "Mejor mándame tu cuenta y te deposito." | "Los pagos se hacen a la cuenta de la empresa y te damos comprobante." | Aceptar depósito personal. |

---

# PARTE C — EVALUACIÓN Y DESEMPEÑO

## 9. Reglas de evaluación y certificación

### 9.1 Tipos de evaluación

| Tipo | Clave | Cómo se evalúa | Mínimo |
|---|---|---|---|
| Quiz de módulo | `quiz_modulo` | 8–10 preguntas al azar del módulo | 80% |
| Examen de ruta | `examen_ruta` | 25 preguntas al azar de la ruta; incluye **todas** las críticas de la ruta | N0/R1 80% · R2/P1 85% · P2 90% · y **100% de críticas** |
| Caso práctico | `caso_practico` | El vendedor captura datos y resultado en el simulador; el sistema compara contra el motor | Resultado correcto + montos con tolerancia de $1 y semanas de 0.1 |
| Juego de roles | `roleplay` | El Director (o asesor designado) califica con rúbrica (9.2) | 80% sin fallar criterio eliminatorio |
| Acompañamiento | `shadowing` | Casos reales donde el vendedor observa o es observado; el evaluador marca "cumple" | Número requerido por ruta (sección 3.2) |
| Entrevista | `entrevista` | Solo P2, con el Director | Aprobada / no aprobada |

### 9.2 Rúbrica de juego de roles (`cap_rubricas`)

| Criterio | Peso | Eliminatorio |
|---|---|---|
| Preguntó la fecha de baja y si trabaja hoy (incluido gobierno) antes que nada | 15 | Sí |
| Identificó el régimen (Ley 73 / Ley 97) | 10 | Sí |
| Presentó monto **y** semanas juntos, como estimado | 20 | Sí |
| No prometió montos ni plazos fuera de los permitidos | 15 | Sí |
| Explicó el honorario con claridad (30% IVA incluido) | 10 | No |
| Manejó la objeción planteada con la respuesta honesta | 15 | No |
| Siguiente paso claro (documentos, fecha, cita con asesor) | 10 | No |
| Tono: claro, tuteo, sin tecnicismos frente al cliente | 5 | No |

**Escenarios de juego de roles:**

- **RP-01** Cliente Ley 97 apto que objeta el 30% (R1).
- **RP-02** Cliente que quiere retirar pero cotiza actualmente (R1).
- **RP-03** Cliente Ley 73 con 950 semanas y 59 años que "necesita el dinero ya" (R2) — debe terminar en
  "no te conviene" + cita con asesor.
- **RP-04** Viuda en unión libre cuya pareja murió hace 8 meses (P1).
- **RP-05** Recién desempleado Ley 73 de 61 años interesado en M40 que cree que tendrá servicio médico (P1).

### 9.3 Intentos

- Quiz: intentos ilimitados, 1 hora de espera entre intentos.
- Examen de ruta: **3 intentos**; después del tercero fallido, 7 días de espera y sesión de repaso con
  el Director.
- Cada intento sirve preguntas al azar y guarda la versión del contenido.

### 9.4 Otorgamiento

La certificación se otorga **automáticamente** cuando se cumplen todos los requisitos de la sección
3.2, excepto P2 (requiere entrevista). El Director recibe aviso y puede revocar con motivo.

### 9.5 Vencimiento y suspensión

| Evento | Efecto |
|---|---|
| Pasan 12 meses | Estado `por_vencer` 30 días antes; al vencer, `vencida`: se pierden los permisos hasta aprobar el examen de recertificación (versión corta de 15 preguntas, mismas reglas de críticas) |
| Cambia un parámetro del que dependen preguntas (UMA cada febrero, semanas mínimas cada enero, piso, honorario, comisión) | Se publica una **microlección de actualización** con quiz de 5 preguntas; el vendedor tiene **30 días**; si no la aprueba, `suspendida` |
| Incidencia de línea roja | `suspendida` de inmediato en todas las rutas; solo el Director la reactiva tras revisión |
| 2 incidencias graves en 90 días (promesa de monto, documento mal pedido que causa rechazo, alerta ignorada) | Repetir el módulo relacionado y su quiz en 14 días |

### 9.6 Contenido versionado

- Cada lección y pregunta tiene `version`. Cambiar el contenido crea versión nueva; los intentos viejos
  conservan la suya.
- Cada pregunta declara los `parametros` de los que depende. Al cambiar un parámetro con
  `vigente_desde`, el sistema marca esas preguntas como `revisar` y crea la tarea para el Director;
  mientras no se revisen, no se sirven en exámenes.

## 10. Métricas de desempeño y coaching

Tablero **"Mi desempeño"** (vendedor) y **"Equipo"** (Director), calculado con datos del CRM:

| Métrica | Meta inicial | Fuente |
|---|---|---|
| Prospectos con primer contacto < 24 h | ≥ 90% | `eventos` vs `personas.created_at` |
| Prospecto → Precalificado | ≥ 50% | Embudo |
| Precalificado APTO → Contrato | ≥ 60% | Embudo |
| Expedientes completos a la primera (sin documento rechazado) | ≥ 80% | `documentos.estado = rechazado` |
| Casos que llegan a Bloqueado por causa del vendedor | ≤ 10% | `motivo` de Bloqueado |
| Retiros Ley 73 con análisis de impacto antes de contrato | 100% | `analisis_impacto_ok` |
| Casos `CALIFICA_NO_CONVIENE` convertidos a asesoría de pensión | ≥ 30% | Casos de desvío creados |
| Alertas atendidas a tiempo | ≥ 90% | `alertas` |
| Incidencias de línea roja | 0 | `cap_incidencias` |
| Referidos generados por clientes cerrados | Seguimiento | `personas.origen = referido` |

**Rutina de coaching:** revisión semanal de 30 minutos (tablero + 2 casos del vendedor). Si dos
métricas quedan debajo de la meta dos semanas seguidas, el sistema sugiere el módulo relacionado
(por ejemplo, rechazos de documentos → R1-06).

> Las metas son iniciales: el Director las ajusta en Configuración (`cap_metas`).

---

# PARTE D — ESPECIFICACIÓN TÉCNICA DEL MÓDULO ACADEMIA

## 11. Modelo de datos

Mismas convenciones de `ESPECIFICACION.md` sección 5: UUID, `created_at`, `updated_at`,
`created_by`, `archivado_at`; nadie borra; bitácora por *trigger*; RLS en todas las tablas.

### 11.1 Contenido

| Tabla | Campos principales | Notas |
|---|---|---|
| `cap_rutas` | `clave` (`N0`,`R1`,`R2`,`P1`,`P2`), `nombre`, `orden`, `prerrequisitos` (array de claves), `permisos_habilita` (jsonb), `vigencia_meses`, `requisitos` (jsonb: módulos, mínimos, casos, roleplays, shadowing), `activa` | Los requisitos de 3.2 viven aquí, no en el código |
| `cap_modulos` | `ruta_id`, `clave` (`R1-03`), `titulo`, `orden`, `duracion_min`, `objetivos`, `contenido_md`, `fuentes` (array de rutas de docs del proyecto), `version`, `publicado` | Contenido en Markdown. Fase A: se carga desde archivos del repositorio |
| `cap_recursos` | `modulo_id`, `tipo` (`lectura`,`video`,`pdf`,`plantilla`,`guion`,`checklist`), `titulo`, `url_o_path` | Videos opcionales (fase posterior) |
| `cap_preguntas` | `modulo_id`, `clave`, `tipo` (`opcion_multiple`,`verdadero_falso`,`numerica`), `enunciado`, `opciones` (jsonb), `correcta`, `tolerancia`, `explicacion`, `critica` (bool), `parametros` (array de claves), `estado` (`activa`,`revisar`,`retirada`), `version` | Sección 6 es la semilla |
| `cap_casos_practicos` | `clave`, `ruta_id`, `titulo`, `narrativa`, `datos_entrada` (jsonb con el mismo esquema que el asistente de precalificación), `resultado_esperado` (jsonb), `explicacion`, `hoy` (fecha de cálculo), `version` | Sección 7. Se validan contra `lib/reglas/` en CI |
| `cap_roleplays` | `clave`, `ruta_id`, `escenario`, `perfil_cliente`, `objecion_principal`, `rubrica_id` | Sección 9.2 |
| `cap_rubricas` / `cap_rubrica_criterios` | `nombre` / `rubrica_id`, `criterio`, `peso`, `eliminatorio` | |

### 11.2 Avance y evaluación

| Tabla | Campos principales |
|---|---|
| `cap_inscripciones` | `usuario_id`, `ruta_id`, `fecha_inicio`, `fecha_objetivo`, `estado` (`en_curso`,`completada`,`pausada`) |
| `cap_progreso` | `usuario_id`, `modulo_id`, `version_modulo`, `estado` (`no_iniciado`,`leyendo`,`completado`), `completado_at`, `tiempo_seg` |
| `cap_evaluaciones` | `tipo` (9.1), `ruta_id` o `modulo_id`, `n_preguntas`, `incluye_criticas` (bool), `minimo` (decimal), `intentos_max`, `espera_horas` |
| `cap_intentos` | `usuario_id`, `evaluacion_id`, `inicio`, `fin`, `preguntas_servidas` (jsonb con versión), `calificacion`, `criticas_ok` (bool), `aprobado` |
| `cap_respuestas` | `intento_id`, `pregunta_id`, `version_pregunta`, `respuesta`, `correcta` |
| `cap_casos_intentos` | `usuario_id`, `caso_id`, `captura` (jsonb), `resultado_motor` (jsonb), `diferencias` (jsonb), `aprobado` |
| `cap_evaluaciones_roleplay` | `usuario_id`, `roleplay_id`, `evaluador_id`, `fecha`, `puntajes` (jsonb por criterio), `total`, `eliminatorio_fallado` (bool), `aprobado`, `comentarios` |
| `cap_shadowing` | `usuario_id`, `caso_id` (FK a `casos` reales), `modo` (`observa`,`observado`), `evaluador_id`, `cumple` (bool), `notas` |
| `cap_diagnosticos_validados` | `usuario_id`, `caso_id`, `validado_por`, `correccion_grave` (bool), `notas` | Requisito de P2 |

### 11.3 Certificación, conducta y metas

| Tabla | Campos principales |
|---|---|
| `cap_certificaciones` | `usuario_id`, `ruta_id`, `otorgada_at`, `vence_at`, `estado` (`vigente`,`por_vencer`,`vencida`,`suspendida`,`revocada`), `motivo`, `otorgada_por` (`sistema` o usuario), `version_contenido`, `excepcion_hasta` |
| `cap_actualizaciones` | `parametro_clave`, `vigente_desde`, `modulo_id` (microlección), `evaluacion_id`, `fecha_limite` |
| `cap_actualizaciones_usuario` | `usuario_id`, `actualizacion_id`, `aprobada_at` |
| `cap_acuses` | `usuario_id`, `documento` (`codigo_conducta`,`privacidad_interna`,`confidencialidad`), `version`, `aceptado_at`, `ip` |
| `cap_incidencias` | `usuario_id`, `caso_id` (opcional), `tipo` (`promesa_monto`,`dato_sensible`,`contrasena_terceros`,`documento_rechazado`,`plazo_prometido`,`alerta_ignorada`,`queja_cliente`,`otro`), `severidad` (`leve`,`grave`,`linea_roja`), `descripcion`, `accion`, `registrada_por` |
| `cap_metas` | `metrica`, `valor`, `vigente_desde` (sección 10) |

**Vista `v_permisos_usuario`:** une `usuarios.rol` + `cap_certificaciones` vigentes (o con
`excepcion_hasta` futura) + `cap_rutas.permisos_habilita`. La consumen las políticas RLS de
`casos`, `calculos` y `documentos`, y la función `tienePermiso()` del servidor.

## 12. Pantallas, alertas e integración con el CRM

### 12.1 Módulo Academia (nuevo en la barra lateral)

1. **Mi ruta:** tarjetas de N0 → P2 con estado, avance (%), requisitos pendientes y fecha objetivo.
   Insignias de certificaciones vigentes y fecha de vencimiento.
2. **Lección:** Markdown renderizado con la marca (sección 11 de la especificación), recuadros "Lo que
   dices" (azul) y "Lo que nunca dices" (rojo), fuentes al pie, botón "Marcar como leída" y quiz al
   final. Funciona en celular.
3. **Examen:** una pregunta por pantalla, sin regresar; al terminar, calificación y explicación de cada
   error. Las críticas falladas se resaltan.
4. **Simulador:** el mismo asistente de precalificación de 4 pasos del CRM, pero con
   `cap_casos_practicos` y sin crear registros reales. Al final compara la captura y el resultado del
   vendedor contra el motor y muestra las diferencias.
5. **Biblioteca rápida ("chuleta"):** guiones, objeciones, checklist de documentos, tabla Ley 73 / Ley
   97, tabla de semanas mínimas por año, tabla de cesantía por edad. Accesible también desde la ficha
   del caso con un botón "?".
6. **Mi desempeño:** métricas de la sección 10 y sugerencias de repaso.

**Panel del Director (rol Director):**

- **Equipo:** avance por vendedor, certificaciones, vencimientos, intentos fallidos.
- **Por evaluar:** juegos de roles y acompañamientos pendientes, con la rúbrica para calificar desde el
  celular.
- **Incidencias:** registrar, ver historial, suspender o reactivar.
- **Contenido:** preguntas en estado `revisar`, versiones, publicar microlecciones de actualización.
- **Excepciones temporales** de permisos (máx. 30 días, con motivo).

### 12.2 Integración con lo que ya existe

- **Ayuda contextual:** cada paso del asistente de precalificación y cada resultado (`APTO`,
  `CALIFICA_NO_CONVIENE`, etc.) enlaza a la lección correspondiente.
- **Bloqueo por permisos:** si el vendedor intenta una acción no habilitada, el sistema explica qué
  certificación la desbloquea ("Para precalificar clientes Ley 73 necesitas R2").
- **Incidencias desde el caso:** el asesor o el Director pueden registrar una incidencia desde la ficha
  del caso; queda ligada al `caso_id`.
- **Comisiones:** la regla de elegibilidad de comisión por certificación (decisión pendiente, sección
  14) se agrega a `esquemas_comision` como condición, sin código nuevo por esquema.
- **Rol Socio licenciatario:** al darlo de alta, se le inscribe automáticamente en N0 → R1 → R2.

### 12.3 Alertas nuevas (se suman al catálogo de la sección 8.1 de la especificación)

| Regla | Cuándo | Severidad | A quién |
|---|---|---|---|
| `CAP_SIN_AVANCE` | 7 días sin avance en una ruta en curso | aviso | Vendedor y Director |
| `CAP_ROLEPLAY_POR_EVALUAR` | Vendedor solicitó juego de roles hace más de 3 días | aviso | Director |
| `CAP_CERT_POR_VENCER` | 30 días antes del vencimiento | aviso | Vendedor y Director |
| `CAP_CERT_VENCIDA` | Día del vencimiento | crítica | Vendedor y Director |
| `CAP_ACTUALIZACION_PENDIENTE` | Microlección publicada; recordatorio a los 7, 21 y 28 días | aviso → crítica el día 28 | Vendedor |
| `CAP_PREGUNTAS_REVISAR` | Cambió un parámetro y hay preguntas en `revisar` | aviso | Director |
| `CAP_INCIDENCIA_LINEA_ROJA` | Se registra una incidencia de línea roja | crítica | Director |
| `CAP_METRICA_BAJA` | Dos métricas debajo de la meta dos semanas seguidas | info | Vendedor y Director |

## 13. Fases de desarrollo y prompts para Claude Code

Cada fase termina en algo usable. No se pasa a la siguiente sin cumplir su criterio de "listo".

1. **Fase A — Contenido y avance.** Tablas de contenido y avance, carga de semillas desde
   `content/academia/`, Mi ruta, Lección, quizzes y examen de ruta, acuses del Código de conducta.
   *Listo cuando:* un vendedor de prueba completa N0 desde el celular y queda certificado.
2. **Fase B — Simulador, certificación y permisos.** Casos prácticos contra el motor, otorgamiento
   automático, `v_permisos_usuario`, bloqueo de acciones en el CRM y ayuda contextual. *Listo cuando:*
   un vendedor sin R1 no puede precalificar (ni por la API) y con R1 sí, salvo Ley 73.
3. **Fase C — Evaluación humana y desempeño.** Juegos de roles, acompañamientos, diagnósticos
   validados, panel del Director, incidencias y tableros de la sección 10.
4. **Fase D — Vigencia y actualización.** Vencimientos, microlecciones ligadas a parámetros, estado
   `revisar` en preguntas, alertas de la sección 12.3.

### 13.1 Prompt de la fase A

```text
Lee docs/ESPECIFICACION.md y docs/CAPACITACION.md completos. Implementa la Fase A del
módulo Academia (CAPACITACION.md secciones 11.1, 11.2 y 12.1 puntos 1 a 3):
1. Propón el esquema de Prisma para TODAS las tablas cap_* de la sección 11 y espera
   mi aprobación.
2. Crea content/academia/ con un archivo Markdown por módulo de la sección 5
   (frontmatter: clave, ruta, titulo, orden, duracion_min, fuentes, version) y
   content/academia/preguntas/*.yaml con el banco de la sección 6, incluido el campo
   parametros. Escribe el script npm run academia:seed que los carga de forma idempotente.
3. Pantallas Mi ruta, Lección (con recuadros "Lo que dices" / "Lo que nunca dices") y
   Examen, mobile-first, con la marca de la sección 11 de ESPECIFICACION.md.
4. Reglas de evaluación de la sección 9.1 y 9.3 en lib/reglas/capacitacion.ts como
   funciones puras con pruebas en Vitest (aprobación con 100% de críticas, intentos,
   esperas).
5. Acuse del Código de conducta (sección 5.1, N0-02) antes de iniciar N0.
Al terminar, muéstrame el recorrido de un vendedor de prueba completando N0.
```

### 13.2 Prompt de la fase B

```text
Fase B de docs/CAPACITACION.md:
1. cap_casos_practicos con la semilla de la sección 7. El simulador reutiliza el
   asistente de precalificación existente en modo "práctica" (no crea personas ni casos).
   Compara captura y resultado contra lib/reglas/retiro.ts y muestra diferencias.
2. Prueba en Vitest que recorre todos los casos C-R* y verifica que resultado_esperado
   coincide con el motor. Si no coincide, la prueba falla: el contenido nunca puede
   contradecir al sistema.
3. Otorgamiento automático de certificaciones según cap_rutas.requisitos (sección 3.2).
4. Vista v_permisos_usuario, función tienePermiso() y políticas RLS. Bloquea en servidor
   y en base de datos las acciones de la sección 3.2. Un vendedor con R1 que captura
   régimen L73 genera la tarea "Revisión de asesor — Ley 73" en lugar del resultado.
5. Ayuda contextual: cada paso del asistente y cada resultado enlaza a su lección.
Prueba con Playwright: vendedor sin R1 → bloqueado; con R1 → precalifica L97; con R1 y
L73 → tarea al asesor; con R2 → precalifica L73.
```

### 13.3 Prompt de la fase C

```text
Fase C de docs/CAPACITACION.md: juegos de roles con la rúbrica de la sección 9.2
(criterios eliminatorios), acompañamientos ligados a casos reales, diagnósticos
validados para P2, panel del Director (sección 12.1), registro de incidencias desde la
ficha del caso con suspensión automática por línea roja (sección 9.5), y los tableros
"Mi desempeño" y "Equipo" con las métricas y metas de la sección 10 (metas en cap_metas).
```

### 13.4 Prompt de la fase D

```text
Fase D de docs/CAPACITACION.md: vencimiento a 12 meses con examen de recertificación,
microlecciones de actualización disparadas por cambios en la tabla parametros
(sección 9.5 y 9.6), estado "revisar" en preguntas dependientes, y las alertas de la
sección 12.3 dentro de la tarea diaria de las 07:00. Antes de empezar, pregúntame las
decisiones pendientes de la sección 14 que afecten esta fase.
```

## 14. Criterios de aceptación y decisiones pendientes

### 14.1 Criterios de aceptación

- [ ] Todo el contenido de la sección 5 se ve correctamente en celular.
- [ ] Un examen no se aprueba si se falla cualquier pregunta crítica, aunque el total sea ≥ mínimo.
- [ ] Los casos C-R01 a C-R09 coinciden con `lib/reglas/` en la prueba automática (montos al centavo,
      semanas a 0.1).
- [ ] Un vendedor sin R1 no puede precalificar ni llamando directo a la API.
- [ ] Un vendedor con R1 no ve resultado comercial para un cliente Ley 73; se crea la tarea al asesor.
- [ ] Una incidencia de línea roja suspende todas las certificaciones del vendedor al momento.
- [ ] Cambiar `UMA_MENSUAL` con nueva vigencia marca para revisión las preguntas R1-Q04 y R1-Q06 y
      dispara la microlección.
- [ ] Una certificación vencida quita los permisos al día siguiente sin intervención.
- [ ] La Academia nunca guarda datos reales de clientes (casos ficticios); los acompañamientos solo
      guardan el `caso_id`.
- [ ] El Director califica un juego de roles desde el celular en menos de 2 minutos.

### 14.2 Decisiones pendientes (Irving)

Cada una tiene un valor por defecto para que el desarrollo no se detenga.

- [ ] **Comisión de casos traídos por un vendedor no certificado para ese servicio** (se reasignan al
      asesor). *Por defecto: el vendedor cobra comisión de referidor, no de vendedor.*
- [ ] **Comisión del vendedor en pensiones, M40, DSSV e ISSSTE.** *Por defecto: sin comisión hasta
      definir (igual que la especificación).*
- [ ] **¿El vendedor en modo aprendiz (solo N0) puede cerrar retiros acompañado?** *Por defecto: no;
      los prospectos que trae los cierra el asesor y él cobra como referidor.*
- [ ] **Quién evalúa juegos de roles y acompañamientos además de Irving.** *Por defecto: solo el
      Director.*
- [ ] **Mínimos aprobatorios** (80/85/90%). *Por defecto: los de la sección 9.1.*
- [ ] **Vigencia de certificaciones.** *Por defecto: 12 meses.*
- [ ] **Videos:** ¿Irving graba explicaciones cortas por módulo? *Por defecto: solo texto en fase A.*
- [ ] **Acompañamientos requeridos** (3 para R1, 2 Ley 73 para R2, 10 diagnósticos para P2). *Por
      defecto: los de la sección 3.2.*
- [ ] **Metas de desempeño** de la sección 10. *Por defecto: las indicadas, ajustables.*

### 14.3 Temas de contenido pendientes de fuente (no enseñarlos como hecho hasta resolverlos)

| Tema | Estado | Cómo se enseña mientras tanto |
|---|---|---|
| Procedimiento de **reintegro** de semanas (art. 198) | Faltan reglas CONSAR | "Existe y es proporcional"; el procedimiento lo ve el asesor |
| Criterio de la SCJN sobre **5 años de concubinato** (AR 408/2025) | Solo prensa | Guion de P1-Q21 |
| Monto del **piso Ley 73** 2026 ($10,636.54) y su fórmula | Fuente secundaria (AMCP) | Lo cita el asesor, no el vendedor |
| **UMA contra salario mínimo** en M40 / pensión Ley 73 | En litigio | Zona prohibida para el vendedor |
| Número "Modalidad 10" (nomenclatura administrativa) | No está en la ley | Se usa "incorporación voluntaria (M10)" |
| ¿El retiro por desempleo del **ISSSTE** descuenta años? | Sin artículo equivalente al 198 | No se vende sin confirmación |
| Conteo exacto del **día 46** en la práctica de cada Afore | Criterio conservador | Baja + 46 días naturales |

---

**Fuentes internas del proyecto usadas para este plan:** `docs/ESPECIFICACION.md`
(`claude/especificacion-sistema-control-clientes.md`), `claude/marco-legal-retiro-desempleo.md`,
`claude/piso-pension-ley-73.md`, `claude/viudez-y-concubinato.md`,
`claude/fallecimiento-que-recupera-la-familia.md`, `claude/issste-y-portabilidad.md`,
`claude/revision-manual-demanda-negativa-pension.md` y las fichas de casos de `claude/casos/`
(anonimizadas en la sección 7).

*Documento interno. Las referencias legales corresponden a los textos vigentes cargados en el
proyecto a noviembre de 2026; verificar reformas antes de actualizar el contenido.*
