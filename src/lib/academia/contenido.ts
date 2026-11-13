// GENERADO por scripts/academia-ts.cjs desde content/academia/. No editar a mano.
// Incluye las respuestas correctas: solo en el servidor.
import "server-only";
import type { Acuse, CasoPractico, Microleccion, Modulo, Pregunta, ReglasEvaluacion, Roleplay, Rubrica, Ruta } from "./tipos";

export const EVALUACION: ReglasEvaluacion = {
 "quiz_modulo": {
  "n": 10,
  "minimo": 0.8,
  "intentos_max": null,
  "espera_horas": 1,
  "bloqueo_dias": 0
 },
 "examen_ruta": {
  "n": 25,
  "intentos_max": 3,
  "espera_horas": 0,
  "bloqueo_dias": 7
 },
 "recertificacion": {
  "n": 15,
  "intentos_max": 3,
  "espera_horas": 0,
  "bloqueo_dias": 7
 },
 "actualizacion": {
  "n": 5,
  "minimo": 0.8,
  "intentos_max": null,
  "espera_horas": 1,
  "bloqueo_dias": 0
 }
};

export const RUTAS: Ruta[] = [
 {
  "clave": "N0",
  "nombre": "Inducción",
  "orden": 0,
  "prerrequisitos": [],
  "vigencia_meses": null,
  "requisitos": {
   "examen": {
    "minimo": 0.8,
    "n": 25
   },
   "acuses": [
    "codigo_conducta",
    "privacidad_interna"
   ]
  },
  "permisos_habilita": [
   "prospecto.crear",
   "prospecto.nota",
   "prospecto.seguimiento",
   "whatsapp.plantillas"
  ]
 },
 {
  "clave": "R1",
  "nombre": "Vendedor de retiro",
  "orden": 1,
  "prerrequisitos": [
   "N0"
  ],
  "vigencia_meses": 12,
  "requisitos": {
   "examen": {
    "minimo": 0.8,
    "n": 25
   },
   "casos": 4,
   "roleplays": [
    "RP-01",
    "RP-02"
   ],
   "shadowing": 3
  },
  "permisos_habilita": [
   "precalificacion.retiro",
   "contrato.retiro.generar",
   "documentos.solicitar"
  ]
 },
 {
  "clave": "R2",
  "nombre": "Retiro avanzado",
  "orden": 2,
  "prerrequisitos": [
   "R1"
  ],
  "vigencia_meses": 12,
  "requisitos": {
   "examen": {
    "minimo": 0.85,
    "n": 25
   },
   "casos": 3,
   "roleplays": [
    "RP-03"
   ],
   "shadowing": 2
  },
  "permisos_habilita": [
   "precalificacion.retiro.L73",
   "analisis_impacto.borrador",
   "caso.desvio.crear"
  ]
 },
 {
  "clave": "P1",
  "nombre": "Detección de pensiones",
  "orden": 3,
  "prerrequisitos": [
   "R2"
  ],
  "vigencia_meses": 12,
  "requisitos": {
   "examen": {
    "minimo": 0.85,
    "n": 25
   },
   "casos": 4,
   "roleplays": [
    "RP-04",
    "RP-05"
   ]
  },
  "permisos_habilita": [
   "prospecto.pension.recibir",
   "diagnostico_inicial.capturar"
  ]
 },
 {
  "clave": "P2",
  "nombre": "Especialista en pensiones",
  "orden": 4,
  "prerrequisitos": [
   "P1"
  ],
  "vigencia_meses": 12,
  "requisitos": {
   "examen": {
    "minimo": 0.9,
    "n": 25
   },
   "diagnosticos": 10,
   "entrevista": true
  },
  "permisos_habilita": [
   "plan_pension.presentar",
   "fallecimiento.integrar_expediente"
  ]
 }
];

export const ACUSES: Acuse[] = [
 {
  "clave": "codigo_conducta",
  "titulo": "Código de conducta y líneas rojas",
  "version": "2026-11",
  "texto": "Como asesor de pensiones de RetiroPorDesempleo.com me comprometo a dar asesoría honesta: decirle al cliente lo que recibe y lo que pierde en semanas, siempre juntos y como estimado.\n\nConozco y acepto que cualquiera de estas faltas (líneas rojas) suspende de inmediato mis certificaciones y se revisa con el Director:\n\n1. Prometer un monto o una fecha de pago como garantizados.\n2. Pedir, anotar o guardar contraseñas de portales de terceros o la e.firma del cliente.\n3. Sugerir, aceptar o facilitar la alteración de salarios, semanas o patrones ficticios.\n4. Recibir dinero del cliente en una cuenta personal o en efectivo sin recibo de la empresa.\n5. Declarar o dejar que el cliente declare desempleo estando empleado (incluido el gobierno).\n6. Ocultar el costo en semanas o presentar el monto sin las semanas.\n7. Decir que el trámite es exclusivo o que el cliente no puede hacerlo solo.\n8. Compartir datos o documentos de un cliente fuera del sistema (grupos de WhatsApp, correo personal, fotos en el carrete del teléfono después de subirlas)."
 },
 {
  "clave": "privacidad_interna",
  "titulo": "Aviso de privacidad interno y confidencialidad",
  "version": "2026-11",
  "texto": "Trato los datos personales de los clientes conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares y al aviso de privacidad de la empresa:\n\n• Antes de pedir NSS, CURP o documentos, el cliente acepta el aviso de privacidad vigente y el sistema lo registra.\n• Subo los documentos directo al sistema desde la cámara del celular y los borro de mi teléfono.\n• Veo los datos sensibles enmascarados (por ejemplo, NSS •••••••1002); es por diseño y no intento obtenerlos por otra vía.\n• Paso al Director el mismo día cualquier solicitud de acceso, rectificación, cancelación u oposición (ARCO).\n• Guardo confidencialidad de la información de clientes y de la empresa, también después de terminar mi relación con ella."
 }
];

export const MODULOS: Modulo[] = [
 {
  "clave": "N0-01",
  "ruta": "N0",
  "titulo": "La empresa, el servicio y cómo ganamos dinero",
  "orden": 1,
  "duracion_min": 60,
  "version": 1,
  "parametros": [
   "HONORARIO_RETIRO_PCT",
   "IVA",
   "COSTO_ADMIN_ALTA",
   "BASE_REPARTO_SOCIO"
  ],
  "fuentes": [
   "docs/ESPECIFICACION.md"
  ],
  "contenido": "**Objetivos:** explicar en 30 segundos qué hace la empresa; conocer el catálogo de servicios,\nhonorarios y su propia comisión.\n\n**Lo que tienes que saber**\n\n- **RetiroPorDesempleo.com** es una firma de asesoría con sede en Cuernavaca (Blvd. Gustavo Díaz\n  Ordaz No. 49, Interior D-3, Col. Acapantzingo). Marca registrada. Contacto: 800 611 1245 ·\n  WhatsApp 56 6474 9567 · hola@retiropordesempleo.com · L-V 9:00-18:00, S 9:00-14:00.\n- **Qué vendemos:** asesoría, cálculo, estrategia, expediente correcto a la primera y\n  acompañamiento. **No** vendemos acceso privilegiado: el trámite ante la Afore es gratuito y\n  personal.\n- **Nuestro diferenciador:** le decimos al cliente **lo que recibe y las semanas que pierde**. Los\n  gestores informales no lo hacen.\n- **Nunca prometemos un monto.** Todo cálculo es un **estimado** hasta que la Afore paga.\n- **Catálogo de servicios** (el mismo del alta de prospectos): retiro por desempleo · asesoría de pensión\n  Ley 73 · Ley 97 · Modalidad 40 · incorporación voluntaria (M10/PTI) · fallecimiento (viudez y\n  recuperación de saldos) · devolución de vivienda Infonavit · corrección de NSS / semanas.\n- **Hacia dónde va la empresa:** la línea prioritaria es la **asesoría de pensión Ley 73**, porque\n  aporta más valor. Los retiros se hacen preferentemente a clientes **Ley 97** o a quienes **no\n  les afecta** su futura pensión.\n- **Honorarios:** retiro = **30% de lo que paga la Afore, IVA incluido**, sin monto mínimo de\n  retiro. Pensión y demás servicios = **honorario fijo** que define la Dirección por caso.\n- **Tu comisión como asesor de pensiones** (esquema vigente): en el retiro recibes **(honorario − costo\n  administrativo del alta) × tu porcentaje** (40% salvo que la Dirección pacte otro contigo). Cada quien paga su\n  IVA: tú facturas tu comisión y la empresa le factura al cliente el honorario completo. La comisión nace\n  **estimada** al firmar, se **devenga** cuando la Afore paga y se cobra el honorario, y se **paga** al liquidarla.\n  Nunca se paga sobre dinero que no ha entrado. Pensiones y otros servicios: por definir con la Dirección.\n- **Programa de referidos** (para que se lo expliques a clientes y conocidos): $1,000 por referido\n  con honorario cobrado; $2,000 c/u si suma 3 a 10 en el mes; $3,000 c/u si suma más de 10.\n\n**Ejemplo que debes saber hacer de memoria:** la Afore deposita $10,000 → honorario $3,000 (subtotal\n$2,586.21 + IVA $413.79) → menos el costo administrativo del alta ($500) → $2,500 × 40% = **tu comisión\n$1,000** (el total de tu factura, IVA incluido). En el sistema ves tus comisiones proyectadas en Hoy.\n\n**Fuente:** `docs/ESPECIFICACION.md` secciones 2 y 9.\n"
 },
 {
  "clave": "N0-02",
  "ruta": "N0",
  "titulo": "Código de conducta, privacidad y líneas rojas",
  "orden": 2,
  "duracion_min": 60,
  "version": 1,
  "parametros": [],
  "fuentes": [],
  "contenido": "**Tu papel: lo que sí haces y lo que nunca haces**\n\n| El asesor de pensiones **SÍ** | El asesor de pensiones **NO** |\n|---|---|\n| Prospecta, da de alta y da seguimiento | Promete montos (\"te van a dar $X\") |\n| Pregunta en el orden correcto (fecha de baja, régimen, si trabaja en gobierno) | Da asesoría legal ni opina sobre juicios |\n| Precalifica con el asistente del sistema y explica el resultado | Calcula una pensión final ni entrega el plan de pensión (eso es del Director) |\n| Muestra **monto estimado + semanas que se pierden**, siempre juntos | Pide, guarda o usa contraseñas de AforeWeb, IMSS Digital, Mi Cuenta Infonavit o e.firma |\n| Explica el honorario con claridad (30% IVA incluido en retiro) | Altera, sugiere alterar o \"acomoda\" salarios, semanas o patrones |\n| Pide documentos y verifica que vengan bien (color, vigencia, sin tachaduras) | Dice que el trámite es exclusivo, privilegiado o que el cliente no puede hacerlo solo |\n| Firma el contrato con folio y registra la aceptación del aviso de privacidad | Recibe dinero del cliente en su cuenta personal |\n| **Dice \"no te conviene\"** cuando el sistema marca `CALIFICA_NO_CONVIENE` y ofrece la asesoría de pensión | Cotiza un porcentaje sobre una pensión mensual |\n| Canaliza al Director o al abogado los casos fuera de su certificación | Cita sentencias de la Corte como si fueran regla de ventanilla |\n\n\n**Objetivos:** conocer las conductas que suspenden la certificación y manejar datos personales\nconforme a la LFPDPPP.\n\n**Líneas rojas** (una sola falta = suspensión inmediata de certificaciones y revisión con el\nDirector; queda registrada como falta de línea roja):\n\n1. Prometer un monto o una fecha de pago como garantizados.\n2. Pedir, anotar o guardar contraseñas de portales de terceros o la e.firma del cliente.\n3. Sugerir, aceptar o facilitar la alteración de salarios, semanas o patrones ficticios.\n4. Recibir dinero del cliente en una cuenta personal o en efectivo sin recibo de la empresa.\n5. Declarar o dejar que el cliente declare desempleo estando empleado (incluido el gobierno).\n6. Ocultar el costo en semanas o presentar el monto sin las semanas.\n7. Decir que el trámite es exclusivo o que el cliente no puede hacerlo solo.\n8. Compartir datos o documentos de un cliente fuera del sistema (grupos de WhatsApp, correo\n   personal, fotos en el carrete del teléfono después de subirlas).\n\n**Privacidad (LFPDPPP — ley de particulares, la que nos aplica):**\n\n- Antes de pedir NSS, CURP o documentos, el cliente acepta el **aviso de privacidad** vigente; el\n  sistema registra versión y fecha.\n- Los documentos se suben **directo al sistema** desde la cámara del celular y se borran del\n  teléfono.\n- El asesor de pensiones ve los datos sensibles **enmascarados** (NSS `•••••••1002`); es por diseño.\n- Solicitudes de acceso, rectificación, cancelación u oposición (ARCO) se pasan al Director el\n  mismo día.\n\n**Lo que dices:** *\"Tus datos solo se usan para tu trámite y se guardan en un sistema protegido.\nAquí tienes nuestro aviso de privacidad.\"*\n\n**Práctica:** el asesor de pensiones firma en el sistema el **acuse del Código de conducta** (al entrar a la Academia).\n"
 },
 {
  "clave": "N0-03",
  "ruta": "N0",
  "titulo": "Conceptos base del sistema de pensiones",
  "orden": 3,
  "duracion_min": 90,
  "version": 1,
  "parametros": [
   "UMA_DIARIA",
   "UMA_MENSUAL",
   "L97_SEMANAS_2021",
   "L97_INCREMENTO_ANUAL",
   "L73_SEMANAS_MINIMAS"
  ],
  "fuentes": [
   "claude/issste-y-portabilidad.md",
   "claude/marco-legal-retiro-desempleo.md"
  ],
  "contenido": "**Objetivos:** hablar el idioma del IMSS y la Afore; identificar el régimen del cliente.\n\n**Lo que tienes que saber**\n\n| Concepto | Qué es, en una línea |\n|---|---|\n| NSS | Número de Seguridad Social, 11 dígitos. Un cliente puede tener **dos** (NSS duplicado) |\n| CURP | De aquí sale fecha de nacimiento y sexo |\n| SBC | Salario Base de Cotización: el salario diario con el que el patrón lo registró en el IMSS |\n| UMA | Unidad de Medida y Actualización. 2026: **$117.31 diaria / $3,566.22 mensual** (vigente del 1-feb-2026 al 31-ene-2027) |\n| Semanas cotizadas | Tiempo registrado en el IMSS. Se consultan en la **Constancia de Semanas Cotizadas** |\n| Bimestres | El retiro modalidad A pide **12 bimestres**, no 104 semanas |\n| Afore | Administra la cuenta individual. Hay 10. El portal AforeWeb lo opera Procesar |\n| Subcuenta RCV | Retiro, Cesantía y Vejez: **de aquí sale el retiro por desempleo** |\n| SAR 92 | Dinero del Seguro de Retiro anterior; **no** entra en el 11.5% |\n| Subcuenta de Vivienda | Infonavit. **No entra** en el retiro por desempleo y no se toca |\n| Aportaciones voluntarias | Se pueden retirar en cualquier momento **sin perder semanas** |\n| Estado de cuenta Afore | Única prueba de la fecha del último retiro |\n\n**⛔ La primera pregunta de todo tema de pensión: ¿Ley 73 o Ley 97?**\n\n| | Ley 73 | Ley 97 |\n|---|---|---|\n| Quién | Cotizó al menos un día **antes del 1 de julio de 1997** | Primera alta **desde el 1 de julio de 1997** |\n| Semanas mínimas | **500** (no cambian nunca) | **875 en 2026**, +25 por año hasta 1,000 en 2031 |\n| Quién paga | El IMSS, con fórmula (promedio de las últimas 250 semanas) | Sale de la cuenta individual |\n| Le sirve M40 | **Sí, es su mercado** | Poco |\n\n**Segunda pregunta obligatoria:** *\"¿Trabaja hoy en el gobierno o en alguna dependencia? ¿A qué\ninstitución le descuentan en su nómina?\"* Quien cotiza hoy al ISSSTE **no está desempleado**.\n\n**Fuente:** `claude/marco-legal-retiro-desempleo.md` sección 0; `claude/issste-y-portabilidad.md`\nsección 0.\n"
 },
 {
  "clave": "N0-04",
  "ruta": "N0",
  "titulo": "El sistema RPD Control para asesores de pensiones",
  "orden": 4,
  "duracion_min": 60,
  "version": 1,
  "parametros": [],
  "fuentes": [],
  "contenido": "**Objetivos:** operar el CRM desde el celular.\n\n- **Alta rápida** (menos de 30 segundos): nombre, WhatsApp, servicio de interés, fecha de baja si la\n  sabe, origen y referidor. El sistema avisa si el teléfono, CURP o NSS ya existe.\n- **Etapas del retiro:** Prospecto → Precalificado → (En espera) → Contrato → Armando expediente →\n  Ingresada → Resolución → Pagado → Honorario cobrado. Bloqueado y Perdido son estados aparte con\n  motivo obligatorio.\n- **Alertas que te llegan:** `PROSPECTO_SIN_CONTACTO` (24 h sin evento), `PROSPECTO_FRIO` (14\n  días), `DIA46_PROXIMO` y `DIA46_HOY`. Se atienden, posponen o descartan con motivo.\n- **Plantillas de WhatsApp:** bienvenida y aviso de privacidad, documentos pendientes, faltan N días,\n  ya puedes retirar, solicitud de referidos.\n- **Tu estado de cuenta de comisiones:** estimadas, devengadas y pagadas.\n\n**Práctica:** recorrido guiado con un prospecto ficticio hasta la alerta del día 46 (ambiente de\npruebas).\n"
 },
 {
  "clave": "R1-01",
  "ruta": "R1",
  "titulo": "El derecho: artículo 191-II LSS",
  "orden": 1,
  "duracion_min": 60,
  "version": 1,
  "parametros": [
   "DIAS_ESPERA_DESEMPLEO",
   "DIAS_ADMINISTRATIVOS",
   "MODALIDAD_A_ANIOS",
   "MODALIDAD_B_ANIOS",
   "MODALIDAD_A_TOPE_UMAS",
   "UMA_MENSUAL",
   "MODALIDAD_B_PCT_RCV"
  ],
  "fuentes": [
   "claude/marco-legal-retiro-desempleo.md"
  ],
  "video": {
   "archivo": "R1-01.mp4",
   "duracion_seg": 119,
   "titulo": "Las 5 condiciones antes de prometer nada (ejemplo con valores 2026)"
  },
  "contenido": "**Lo que tienes que saber — las 5 condiciones antes de prometer nada:**\n\n1. **Día 46 natural** desde que quedó desempleado. Criterio de la casa: `fecha de baja + 46 días`.\n   Baja el 1-oct-2026 → puede pedirlo el **16-nov-2026**. En el sistema verás dos fechas: la **legal** (día 46) y\n   la del **trámite**, que suma los días administrativos de la firma (parámetro vigente en Configuración).\n2. **Antigüedad de la cuenta** (no del trabajador): 3 años para modalidad A, 5 para B. La\n   antigüedad cuenta toda la historia, también la anterior a 2009 (Transitorio Segundo, DOF\n   26-05-2009). Un cliente con cuenta vieja califica aunque crea que no.\n3. **12 bimestres** de cotización en la cuenta (modalidad A).\n4. **Sin retiros en los 5 años previos**, acreditado con estados de cuenta de la Afore.\n5. **La elección A o B es del trabajador**, y la ley le permite irse por A aunque califique a B.\n\n**Modalidades**\n\n| | Modalidad A | Modalidad B |\n|---|---|---|\n| Requisito | Cuenta con 3+ años **y** 12+ bimestres | Cuenta con 5+ años |\n| Monto | 30 días del **último SBC**, tope **10 UMA mensuales = $35,662.20** (2026) | Lo **menor** entre 90 días del SBC promedio de las últimas 250 semanas y el **11.5% del saldo RCV** |\n| Pago | Una exhibición | Hasta **6 mensualidades** (la primera puede ser de 30 días de SBC). Si se reincorpora a trabajar, se suspenden las siguientes |\n\nNinguna modalidad paga más que el saldo RCV.\n\n**Fuente:** art. 191-II LSS (texto vigente en `claude/marco-legal-retiro-desempleo.md` sección 1).\n"
 },
 {
  "clave": "R1-02",
  "ruta": "R1",
  "titulo": "Cómo se calcula",
  "orden": 2,
  "duracion_min": 90,
  "version": 1,
  "parametros": [
   "MODALIDAD_A_DIAS_SBC",
   "MODALIDAD_A_TOPE_UMAS",
   "UMA_MENSUAL",
   "MODALIDAD_B_DIAS_SBC",
   "MODALIDAD_B_PCT_RCV"
  ],
  "fuentes": [
   "docs/ESPECIFICACION.md"
  ],
  "video": {
   "archivo": "R1-02.mp4",
   "duracion_seg": 110,
   "titulo": "Cómo se calcula, paso a paso (ejemplo con valores 2026)"
  },
  "contenido": "**Orden de operaciones (el mismo que usa la calculadora del sistema):**\n\n1. Modalidad A: `30 × SBC último`.\n2. Aplicar tope de 10 UMA ($35,662.20). Se activa con SBC mayor a **$1,188.74 diarios**: arriba de\n   eso, ganar más no aumenta el retiro.\n3. Comparar contra el saldo RCV y pagar el menor.\n4. Modalidad B: `menor(90 × SBC promedio 250 semanas, 11.5% × saldo RCV sin SAR 92)`.\n5. Dividir el monto entre el saldo RCV → porcentaje que se retira → semanas que se pierden (R1-03).\n\n**Trampas frecuentes**\n\n- La **Circular CONSAR 31-10** (enero 2009) dice 75 días y 10%. **Está desactualizada**: la LSS se\n  reformó en mayo de 2009 y dice **90 días y 11.5%**. Manda la ley.\n- El **SBC promedio** no lo inventamos: sale de los movimientos de salario de la constancia de semanas (o de\n  la Certificación de baja del IMSS, si el cliente la tiene). Si no hay dato, la modalidad B queda como estimado.\n- **Salario alto con saldo bajo** casi siempre significa poco tiempo en el sistema formal: suele caer\n  en B por el 11.5% y cobra mucho menos de lo que espera. Adviértelo antes.\n- Puede haber **retención de ISR**: nunca prometas el neto exacto.\n\n**Fuente:** reglas de la calculadora acordadas, tal como están en `docs/ESPECIFICACION.md`\nsección 7.2.\n"
 },
 {
  "clave": "R1-03",
  "ruta": "R1",
  "titulo": "El costo real: semanas que se pierden — art. 198 LSS",
  "orden": 3,
  "duracion_min": 60,
  "version": 1,
  "parametros": [
   "HONORARIO_RETIRO_PCT"
  ],
  "fuentes": [],
  "video": {
   "archivo": "R1-03.mp4",
   "duracion_seg": 110,
   "titulo": "Cuántas semanas cuesta un retiro, paso a paso"
  },
  "contenido": "**La fórmula, en este orden:**\n\n```\ncociente          = saldo RCV ÷ semanas cotizadas\nsemanas perdidas  = monto retirado ÷ cociente\nsemanas después   = semanas cotizadas − semanas perdidas\n```\n\nEjemplo: saldo $100,000, 400 semanas, retira $15,000 → cociente $250 → pierde **60 semanas**\n(15% del saldo) → le quedan 340.\n\n- Las semanas **se pueden recuperar** reintegrando el dinero (proporcional). Las reglas de reintegro\n  las emite CONSAR — **pendiente de fuente**: no expliques el procedimiento, solo que existe.\n- No confundas dos cosas: las semanas que se **descuentan por el retiro** (art. 198) son distintas\n  de las semanas viejas que **se reconocen al volver a cotizar** (art. 151).\n\n**Lo que dices:** *\"Puedes retirar hasta $15,000, estimado. A cambio se descuentan 60 de tus 400\nsemanas; te quedarías con 340. Esas semanas se pueden recuperar si después reintegras el dinero.\nNuestro honorario sería $4,500 con IVA incluido.\"*\n\n**Lo que nunca dices:** *\"No pierdes nada\"*, *\"las semanas no importan\"*, o el monto sin las\nsemanas.\n"
 },
 {
  "clave": "R1-04",
  "ruta": "R1",
  "titulo": "Leer los documentos del cliente",
  "orden": 4,
  "duracion_min": 90,
  "version": 1,
  "parametros": [],
  "fuentes": [],
  "contenido": "**Constancia de Semanas Cotizadas**\n\n- Cuenta **bimestres con aportación**, no semanas. Un historial fragmentado toca más bimestres con\n  menos semanas.\n- Muestra semanas **descontadas** por retiros, pero **no la fecha** del retiro. El candado de 5 años\n  solo se verifica con el **estado de cuenta de la Afore** → mientras no lo tengas, el resultado es\n  `APTO_BLOQUEADO`.\n- Fecha de **primera alta** antes del 1-jul-1997 → Ley 73.\n- **Constancia en ceros con NSS asignado** → tres sospechas: NSS duplicado, cotizó en el ISSSTE o\n  nunca cotizó formalmente. Pregunta: *\"¿Trabajaste con recibo de nómina? ¿En qué sector?\"*\n- Si aparece un **alta vigente** (cotiza actualmente) → no puede retirar todavía.\n\n**Estado de cuenta de la Afore:** saldo RCV, SAR 92, vivienda (se muestra en otra columna desde el\nprimer contacto, nunca se suma), voluntarias y movimientos de retiros previos.\n\n**Certificación de la Baja del Trabajador Desempleado (IMSS):** la firma **ya no la pide** en el expediente. Si el\ncliente la tiene, sirve para confirmar el SBC promedio de 250 semanas.\n\n**Lectura automática:** al subir la constancia en PDF a Documentos, el botón «Leer constancia» llena semanas,\nfecha de baja, primera alta, último salario y el régimen (Ley 73 si la primera alta es antes del 1-jul-1997).\nTú revisas y confirmas.\n\n**Práctica:** el simulador muestra constancias ficticias y el asesor de pensiones captura régimen, semanas,\nbimestres, fecha de baja y si hay retiros previos.\n"
 },
 {
  "clave": "R1-05",
  "ruta": "R1",
  "titulo": "Precalificación: preguntas en orden y los 6 resultados",
  "orden": 5,
  "duracion_min": 90,
  "version": 1,
  "parametros": [],
  "fuentes": [],
  "contenido": "**Orden de preguntas en el primer contacto** (el asistente del CRM las hace en este orden):\n\n1. ¿Cuándo te dieron de baja? (fecha exacta)\n2. ¿Estás trabajando hoy, en una empresa o en el gobierno? ¿A qué institución te descuentan?\n3. ¿Ya has retirado de tu Afore antes? ¿Cuándo?\n4. ¿Empezaste a trabajar antes de julio de 1997? (régimen)\n5. ¿Qué edad tienes? (55+ y Ley 73 → probable desvío a pensión)\n6. ¿Tienes tu constancia de semanas y tu estado de cuenta de la Afore?\n7. ¿Tienes aportaciones voluntarias?\n\n**Los 6 resultados** (el sistema los evalúa en este orden; gana el primero que se cumple):\n\n| # | Resultado | Qué significa | Qué haces |\n|---|---|---|---|\n| 1 | `NO_ELEGIBLE_DEFINITIVO` | Constancia en ceros sin explicación, o cuenta que no llega a 3 años sin posibilidad de completarla | Explicas por qué, agradeces y archivas con motivo |\n| 2 | `NO_ELEGIBLE_DESVIO` | No califica al retiro pero sí a otro servicio (Ley 73 con 55+, NSS duplicado, voluntarias, M40/M10, Infonavit) | Ofreces el servicio sugerido; el sistema crea el caso |\n| 3 | `NO_TODAVIA` | Cotiza hoy, o el día 46 o el candado de 5 años están en el futuro, o le faltan meses para los 3 años | Le das **la fecha** y queda en espera con alerta |\n| 4 | `APTO_BLOQUEADO` | Todo cumple, pero falta verificar el último retiro, el IDE o la cuenta está \"asignada\" | Pides el documento o la cita que falta |\n| 5 | `CALIFICA_NO_CONVIENE` | Califica, pero las semanas que pierde ponen en riesgo su pensión | **Le dices que no le conviene** y ofreces asesoría de pensión |\n| 6 | `APTO` | Todo lo demás | Generas contrato |\n\n**No hay monto mínimo de retiro para tomar un caso.** (La regla anterior de \"no tomar si el retiro\nes menor al honorario\" ya no aplica.)\n"
 },
 {
  "clave": "R1-06",
  "ruta": "R1",
  "titulo": "Expediente, portal y plazos",
  "orden": 6,
  "duracion_min": 90,
  "version": 1,
  "parametros": [
   "SLA_DIAS_HABILES",
   "AFORE_DIAS_HABILES",
   "VIGENCIA_CONTRATO_DIAS"
  ],
  "fuentes": [],
  "contenido": "**Checklist del retiro** (Regla 32ª Circular CONSAR 31-10 + práctica del portal):\n\n| Documento | Lo que tumba el trámite |\n|---|---|\n| INE (o cédula, pasaporte, cartilla) | Vigente, legible |\n| Comprobante de domicilio | **Máximo 3 meses** |\n| Estado de cuenta de la Afore | Para el candado y el saldo |\n| Constancia de semanas | — |\n| Estado de cuenta bancario | Cuenta **nivel 4** a nombre del cliente. Las cuentas solo digitales (Nu, Mercado Pago) suelen fallar |\n| Todo | Fotos **a color** desde el celular, de preferencia de 256 KB o más (si pesa menos, el sistema la sube con aviso y quien valida revisa que se lea), sin tachaduras ni enmendaduras |\n\n**Cuenta registrada:** aunque el comprobante de registro ya no se pide, revisa en el estado de cuenta que la\ncuenta esté **registrada** y no «asignada»: una cuenta asignada no puede retirar.\n\n**Constancia de semanas:** puedes pedirla desde el caso con «Pedir constancia al IMSS» (portal oficial, con el\ncorreo de constancias de la empresa); llega sola a Documentos.\n\n**El bloqueo más común: el IDE (Expediente de Identificación).** Sin biometría registrada el portal\nno avanza y manda al cliente a cita presencial. La cita debe agendarse como **\"Expediente de\nIdentificación (IDE)\"**, no como \"Retiro parcial por desempleo\", o lo regresan.\n\n**Plazos que le puedes decir al cliente (y ninguno más):**\n\n- La firma ingresa la solicitud en un máximo de **15 días hábiles** desde que el expediente está\n  **completo**.\n- La Afore tiene **5 días hábiles** para resolver, según su acuse.\n- El contrato vale **90 días naturales**; el conteo se **suspende** mientras falten documentos del\n  cliente.\n- **Nunca** prometas plazos más largos ni \"en 30 días te paga\": genera riesgo legal.\n"
 },
 {
  "clave": "R1-07",
  "ruta": "R1",
  "titulo": "Proceso comercial: contacto, objeciones y cierre",
  "orden": 7,
  "duracion_min": 120,
  "version": 1,
  "parametros": [],
  "fuentes": [],
  "contenido": "**Embudo del asesor de pensiones**\n\n1. **Primer contacto en menos de 24 h** (si no, `PROSPECTO_SIN_CONTACTO`). La primera pregunta es la\n   fecha de baja.\n2. **Precalificación** con el asistente, con la constancia y el estado de cuenta en mano.\n3. **Presentación del resultado**: modalidad A y B lado a lado, monto estimado, semanas que pierde,\n   honorario y neto estimado. Se entrega la **hoja de precalificación en PDF**.\n4. **Cierre:** contrato con folio `RP-####` (mismo número que el caso) + aviso de privacidad\n   aceptado. Explicar: 90 días de vigencia, suspensión por documentos, alcance (no incluye asesoría\n   legal; si se necesita abogado es un pago aparte).\n5. **Expediente:** lista de documentos por WhatsApp con la plantilla.\n6. **Seguimiento** hasta el pago y el cobro del honorario.\n7. **Referidos:** al cerrar, plantilla \"Solicitud de referidos\".\n\n**Fuentes de prospectos:** formulario web (llega con origen `web`), WhatsApp, llamada, referidos,\nredes. Todo prospecto se registra en el sistema el mismo día; **no se llevan listas paralelas**.\n\n\n\n**Guiones base**\n\n**G-01 · Primer contacto (retiro)**\n\n> *\"Hola {nombre}, soy {asesor de pensiones} de RetiroPorDesempleo.com. Te ayudamos a saber si puedes retirar\n> de tu Afore por desempleo, cuánto te tocaría y —algo que casi nadie te dice— cuántas semanas\n> pierdes. Para empezar, ¿en qué fecha te dieron de baja? ¿Y hoy estás trabajando en alguna empresa\n> o en el gobierno?\"*\n\n**G-02 · Presentación del resultado (APTO)**\n\n> *\"Con tus documentos, puedes retirar hasta {monto}, estimado; el monto final lo determina la Afore.\n> A cambio se descuentan {semanas} de tus {total} semanas y quedarías con {después}. Se pueden\n> recuperar si después reintegras el dinero. Nuestro honorario es el 30% de lo que te deposite la\n> Afore, con IVA incluido: {honorario} estimado. Te dejo la hoja con los números.\"*\n\n**G-03 · No te conviene (`CALIFICA_NO_CONVIENE`)**\n\n> *\"Te voy a ser honesto: sí calificas, pero no te lo recomiendo. Con este retiro bajarías a {después}\n> semanas y para pensionarte en {año} necesitas {mínimo}. Recibirías {monto} hoy, pero podrías perder\n> tu pensión. Lo que sí te conviene es que planeemos tu pensión; te agendo con nuestro especialista en pensiones.\"*\n\n**G-04 · No todavía (`NO_TODAVIA`)**\n\n> *\"Todavía no puedes, pero ya tenemos la fecha: a partir del {fecha}. Te escribo unos días antes para\n> tener tus documentos listos y que no pierdas tiempo.\"*\n\n**Objeciones**\n\n| Objeción | Respuesta honesta | Nunca digas |\n|---|---|---|\n| \"Eso lo puedo hacer yo solo, es gratis.\" | \"Tienes razón, el trámite es gratuito y lo puedes hacer tú. Lo que nosotros hacemos es calcular cuánto te toca y cuántas semanas pierdes, revisar que tu expediente vaya bien a la primera y acompañarte hasta el depósito. Si prefieres hacerlo solo, te dejo la lista de documentos.\" | \"Sin nosotros no te lo dan.\" |\n| \"¿Por qué 30%? Es mucho.\" | \"Es sobre lo que realmente te deposita la Afore, con IVA incluido, y solo si te pagan. Incluye el cálculo, el expediente y el seguimiento.\" | Inventar descuentos no autorizados. |\n| \"Un gestor me cobra menos.\" | \"Pregúntale cuántas semanas vas a perder. Nosotros te lo decimos por escrito antes de firmar.\" | Hablar mal de personas concretas. |\n| \"Me dijeron que me dan más.\" | \"Te enseño el cálculo con tus datos; la ley pone un tope. Si alguien te promete más, pregúntale de dónde sale.\" | Subir el estimado para igualar. |\n| \"¿Cuándo me pagan?\" | \"Ingresamos en máximo 15 días hábiles desde que tu expediente está completo, y la Afore tiene 5 días hábiles para resolver.\" | Una fecha de depósito garantizada. |\n| \"¿Pierdo mi pensión?\" | \"Pierdes semanas, en proporción a lo que retiras. Te digo exactamente cuántas y si te afecta para pensionarte.\" | \"No pierdes nada.\" |\n| \"¿Pierdo mi Infonavit?\" | \"No, el retiro no toca la subcuenta de vivienda.\" | — |\n| \"No quiero dar mis datos.\" | \"Es entendible. Solo los usamos para tu trámite, en un sistema protegido; aquí está el aviso de privacidad. Sin tu constancia y estado de cuenta no te puedo dar un cálculo responsable.\" | Presionar. |\n| \"¿Me garantizas el monto?\" | \"No, y desconfía de quien te lo garantice. Te garantizo que vas a saber los números reales antes de firmar.\" | \"Sí.\" |\n| \"Mejor mándame tu cuenta y te deposito.\" | \"Los pagos se hacen a la cuenta de la empresa y te damos comprobante.\" | Aceptar depósito personal. |\n"
 },
 {
  "clave": "R2-01",
  "ruta": "R2",
  "titulo": "Retiro contra pensión: el análisis de impacto",
  "orden": 1,
  "duracion_min": 90,
  "version": 1,
  "parametros": [
   "L97_SEMANAS_2021",
   "L97_INCREMENTO_ANUAL",
   "L97_SEMANAS_TOPE",
   "L73_SEMANAS_MINIMAS",
   "L73_SEMANAS_CRITICAS"
  ],
  "fuentes": [],
  "contenido": "**Ley 97:** el mínimo de semanas depende del año en que el cliente cumple 60:\n`mínimo = menor(1000, 750 + 25 × (año − 2021))` → 875 en 2026, 900 en 2027, 925 en 2028, 950 en\n2029, 975 en 2030 y 1,000 desde 2031.\n\n- Si el cliente tiene **55 años o más** y las semanas después del retiro quedan **debajo** del mínimo\n  de su año → alerta **crítica** → `CALIFICA_NO_CONVIENE`.\n- Si quedan **a menos de 50 semanas** del mínimo → aviso.\n\n**Ley 73:** necesita 500 semanas; cada **52 semanas arriba de 500 es un incremento anual** de su\npensión (art. 167 LSS 1973). Fracciones: sobrante de 13 a 26 semanas = medio incremento; más de 26 =\nuno completo.\n\n- Ejemplo: 900 semanas → 400 arriba de 500 → 7 años (364) + 36 de sobrante (> 26) = **8\n  incrementos**. Si el retiro le quita 30 → 870 → 7 años + 6 = **7 incrementos**: pierde uno, de por\n  vida.\n- Si las semanas después quedan debajo de **550** → alerta crítica.\n\n**Regla de política que el sistema hace cumplir:** un retiro Ley 73 **no pasa a Contrato** sin\nanálisis de impacto registrado (semanas antes y después, incrementos o umbral) y la casilla \"el\ncliente recibió y entendió el costo en semanas\". El asesor de pensiones R2 captura el borrador; el Director lo\nvalida.\n\n**El cliente más delicado:** Ley 73 con muchas semanas. Es el que más tiene que perder y el que más\nse deslumbra con el dinero inmediato. Aquí la asesoría honesta muchas veces es **\"no lo hagas\"**, y\ndecirlo es lo que construye reputación y referidos.\n"
 },
 {
  "clave": "R2-02",
  "ruta": "R2",
  "titulo": "Desvíos: lo que puedes ofrecer en lugar del retiro",
  "orden": 2,
  "duracion_min": 60,
  "version": 1,
  "parametros": [],
  "fuentes": [],
  "contenido": "| Si detectas… | Ofreces… |\n|---|---|\n| Necesita liquidez pero no puede perder semanas | Revisar **aportaciones voluntarias**: se retiran sin costo en semanas (art. 192) |\n| Ley 73, 55+ años, o cerca de pensionarse | **Asesoría de pensión** (ruta P) |\n| Recién dado de baja, Ley 73, menos de 5 años de la baja | **Modalidad 40** (ruta P) |\n| Recién dado de baja con padecimiento crónico | **Incorporación voluntaria (M10)** dentro de 12 meses (ruta P) |\n| NSS duplicado o semanas que no aparecen | **Corrección de NSS / semanas** |\n| Retiró por matrimonio hace años y sus semanas siguen descontadas | Reclamar la **reintegración** (Transitorio Sexto, DOF 26-05-2009) |\n| Pensionado que nunca usó crédito Infonavit | **Devolución de vivienda** |\n\n**Preguntas frecuentes del recién desempleado:**\n\n- *\"¿Me quedo sin seguro médico?\"* — Si tenía al menos 8 semanas cotizadas seguidas antes de la baja,\n  conserva **8 semanas** de atención médica, él y sus beneficiarios (art. 109 LSS).\n- *\"¿Pierdo mis semanas viejas si dejo de trabajar?\"* — No. Al volver a cotizar se reconocen; según\n  el tiempo fuera puede requerir 26 o 52 semanas nuevas (art. 151 LSS).\n- *\"¿Pierdo mi Infonavit?\"* — El retiro no toca la subcuenta de vivienda.\n"
 },
 {
  "clave": "P1-01",
  "ruta": "P1",
  "titulo": "Pensión Ley 73: cómo se arma y las decisiones irreversibles",
  "orden": 1,
  "duracion_min": 120,
  "version": 1,
  "parametros": [],
  "fuentes": [
   "claude/marco-legal-retiro-desempleo.md",
   "claude/piso-pension-ley-73.md"
  ],
  "contenido": "**Requisitos:** 500 semanas + 60 años (cesantía, además de quedar **sin trabajo remunerado**) o 65\n(vejez). Invalidez: 150 semanas y dictamen médico del IMSS.\n\n**Cómo se calcula (en concepto):** cuantía básica + incrementos anuales sobre el **salario promedio\nde las últimas 250 semanas** (art. 167 LSS 1973). Por eso la Modalidad 40 funciona: sube ese\npromedio.\n\n**Cesantía se paga reducida (art. 171):**\n\n| Edad | 60 | 61 | 62 | 63 | 64 | 65 (vejez) |\n|---|---|---|---|---|---|---|\n| % de la pensión de vejez | 75% | 80% | 85% | 90% | 95% | 100% |\n\nSe suma un año cuando la edad pasa en 6 meses.\n\n**🚨 La puerta de un solo sentido (art. 148):** firmar la cesantía **cierra para siempre** la\ninvalidez y la vejez. Un cliente de 63 años que firma cesantía se queda con el 90% de por vida.\nPara un cliente de 60 a 64 con padecimiento crónico hay que comparar tres rutas **antes de firmar\nnada**: cesantía ahora, invalidez (100%, depende de dictamen del IMSS — **nunca lo prometemos**) o\nesperar a vejez.\n\n**El piso (arts. 168 y 169):** ninguna pensión Ley 73 puede ser menor al piso. Para pensiones que se\notorgan en 2026 se trabaja con **$10,636.54 al mes**. Consecuencias:\n\n- Si la cuantía calculada del cliente queda debajo del piso, **pensionarse a los 60 o a los 65 paga\n  lo mismo** → la recomendación es los 60 (cumpliendo el requisito de quedar sin trabajo).\n- Las asignaciones familiares (15% esposa, 10% por hijo) **no se suman encima del piso**: quedan\n  dentro de él. No dejes que un gestor le cobre por \"gestionar asignaciones\" a alguien en el piso.\n- El piso aplica a pensiones **otorgadas** ese año. Las pensiones en curso suben por inflación\n  (INPC). **No prometas \"nivelar\" una pensión vieja al piso de hoy.**\n\n**Conservación de derechos (art. 182 LSS 1973):** quien deja de cotizar conserva su derecho a\npensión por **¼ del tiempo cotizado** desde la baja, **mínimo 12 meses**. Si se vence antes de\ncumplir 60, **no adquiere el derecho** (art. 280) hasta recuperar cotizando de nuevo. Es la\nprimera fecha que hay que calcular en todo cliente Ley 73 que no cotiza.\n\n**Lo que dices:** *\"Antes de firmar cualquier cosa en el IMSS, déjame que el Director compare tus\nrutas. Hay decisiones que no tienen regreso.\"*\n\n**Fuente:** `claude/marco-legal-retiro-desempleo.md` secciones 0-bis y 0-ter;\n`claude/piso-pension-ley-73.md`.\n"
 },
 {
  "clave": "P1-02",
  "ruta": "P1",
  "titulo": "Pensión Ley 97",
  "orden": 2,
  "duracion_min": 60,
  "version": 1,
  "parametros": [],
  "fuentes": [],
  "contenido": "- Requisitos: semanas del año (875 en 2026) + 60 (cesantía) o 65 (vejez).\n- La pensión sale de la **cuenta individual**: **renta vitalicia** (aseguradora, de por vida, no\n  deja saldo) o **retiro programado** (el saldo se queda en la Afore y el remanente **sí** se\n  hereda). Elegir entre las dos es, en el fondo, una decisión sobre herencia. Se puede pasar de\n  retiro programado a renta vitalicia, no al revés.\n- **Pensión garantizada** (art. 170): tabla por salario, edad y semanas. Los importes de la tabla\n  son de **diciembre de 2020** y se actualizan cada febrero por inflación → **nunca cotices esos\n  pesos tal cual**.\n- Sin las semanas a los 60: puede **retirar su saldo en una exhibición** o seguir cotizando\n  (art. 154).\n"
 },
 {
  "clave": "P1-03",
  "ruta": "P1",
  "titulo": "Modalidad 40 y Modalidad 10",
  "orden": 3,
  "duracion_min": 120,
  "version": 1,
  "parametros": [],
  "fuentes": [],
  "contenido": "| | **Modalidad 40** (continuación voluntaria, arts. 218-221) | **Modalidad 10** (incorporación voluntaria, art. 13-I y 222-233) |\n|---|---|---|\n| Para quién | **Ley 73**, para subir el promedio de las últimas 250 semanas | Independientes; también para seguir sumando semanas |\n| Entrada | 52 semanas en los últimos 5 años **y** solicitarla **dentro de 5 años** de la baja | Ser trabajador independiente |\n| Servicio médico | **❌ No** | **✅ Sí**, con tiempos de espera |\n| Se cae por | **2 meses sin pagar** (con 12 meses para reingresar) | No pagar las cuotas |\n\n**M10 — la ventana de oro (art. 85 RACERF):** si se solicita **dentro de 12 meses** de la baja y\ntenía **52 semanas** antes, **no hay** cuestionario médico, rechazo por enfermedad preexistente ni\ntiempos de espera. Pasado el plazo, padecimientos como complicaciones de diabetes, insuficiencia\nrenal, cáncer o VIH impiden entrar (art. 82). **Pregunta la fecha de baja antes que la salud.**\n\n**Tiempos de espera de M10 (art. 83):** parto **10 meses**; ciertas cirugías 1 año; cirugía\nortopédica 2 años. Aplican solo a ese padecimiento; lo demás está cubierto desde el inicio.\n\n**Los tres errores que nunca cometes:**\n\n1. Vender M40 a un cliente Ley 97.\n2. Dejar que el cliente crea que M40 le da servicio médico (va por escrito).\n3. No advertir que 2 meses sin pagar lo dan de baja (va firmado).\n\n**Zona prohibida:** el tope de cotización y la pensión en **UMA contra salario mínimo** está en\nlitigio. **No proyectes ni prometas resultados en salarios mínimos.** Eso lo calcula el Director con\nel criterio vigente a la fecha.\n\n**Lo que dices a la embarazada que quiere M10 para el parto:** *\"El IMSS tiene 10 meses de espera\npara parto en esta modalidad. Si te inscribes hoy, el parto no te lo cubren. Te lo dejo por\nescrito.\"*\n"
 },
 {
  "clave": "P1-04",
  "ruta": "P1",
  "titulo": "Fallecimiento, viudez y concubinato",
  "orden": 4,
  "duracion_min": 120,
  "version": 1,
  "parametros": [],
  "fuentes": [
   "claude/fallecimiento-que-recupera-la-familia.md",
   "claude/viudez-y-concubinato.md"
  ],
  "contenido": "**Regla de oro:** cuando muere un asegurado Ley 73, lo más valioso casi nunca es lo que tenía en la\nAfore: es la **pensión de viudez**, mensual y de por vida. Primero se revisa la pensión; después el\ndinero.\n\n**Lo que puede recuperar la familia:**\n\n| Qué | Ante quién | Tipo |\n|---|---|---|\n| Pensión de viudez (90%) y orfandad (20% c/u; 30% si es huérfano de ambos) | IMSS | Mensual |\n| Ramo de retiro (SAR 92 + Retiro 97) y voluntarias | Afore o Fondo de Pensiones para el Bienestar | Una exhibición |\n| Vivienda (Fondo de Ahorro 72-92, Vivienda 92 y 97) si nunca usó crédito | Infonavit o Fondo Bienestar | Una exhibición, **exenta** |\n| Ayuda de gastos de funeral (2 meses de salario mínimo) | IMSS | Una vez; piden la **factura original** de la funeraria |\n\n**Requisitos de la viudez Ley 73:** el finado tenía **150 semanas** o era pensionado, la muerte no\nfue riesgo de trabajo, **y** al morir seguía cotizando o estaba **dentro de su conservación de\nderechos**. Si había dejado de cotizar hace mucho sin pensionarse, puede no proceder → caso para el\nDirector y el abogado.\n\n**⏰ Urgencia:** el derecho a la pensión no prescribe, pero **solo se pagan las mensualidades de los\núltimos 12 meses** (art. 279). Cada mes sin solicitar es un mes que la viuda ya no cobra.\n\n**La trampa del matrimonio tardío (art. 154 LSS 1973):** no hay viudez si murió antes de 6 meses de\nmatrimonio; o si se casó después de los 55 años de él o ya pensionado, **salvo que haya pasado un\naño**. **Ninguna aplica si tuvieron hijos.**\n\n**Concubinato:** el IMSS **no acepta** cartas del ayudante municipal ni actas ante notario. Pide\n**sentencia de un Juzgado Familiar + el auto que la declara ejecutoriada** (pídanse juntas). Con el\ntitular **vivo** es un trámite de semanas y bajo costo; ya fallecido, es un juicio. **Con un hijo en\ncomún**, el acta de nacimiento sustituye la prueba de los 5 años.\n\n**Recomendación general (la decide el Director con el cliente):** con hijos en común → casarse. Sin\nhijos y sano → casarse. Sin hijos y enfermo grave → declaración judicial de concubinato ya, estando\nvivo.\n\n**Afore sin beneficiarios designados** → el dinero se reparte según el **art. 501 de la LFT**,\nmuchas veces con juicio. **Designar beneficiarios en la Afore es gratis, toma una hoja y es la\nacción de mayor valor que puedes recomendar a cualquier cliente.**\n\n**Finados que habrían cumplido 70:** su dinero de Afore y vivienda puede estar ya en el **Fondo de\nPensiones para el Bienestar**. No se pierde (imprescriptible), pero cambia la ventanilla. Verifica\nantes de prometer.\n\n**Lo que nunca dices:**\n\n- *\"Ya no piden los cinco años, lo dijo la Corte.\"* (El amparo AR 408/2025 viene de prensa y la\n  ventanilla sigue pidiéndolos. Lo correcto: *\"si se lo niegan por el tiempo, hay con qué pelearlo,\n  con abogado y con plazos\"*.)\n- *\"Su viudo no tiene derecho\"* a un viudo Ley 73: probablemente sí, por la vía de amparo. Es caso del\n  abogado.\n\n**Política de la firma:** el depósito siempre llega a la cuenta de la viuda; nunca se cobra porcentaje\nsobre la pensión mensual; lo que sea juicio lo lleva el abogado de la firma y se explica por\nseparado.\n\n**Fuente:** `claude/fallecimiento-que-recupera-la-familia.md`; `claude/viudez-y-concubinato.md`.\n\n\n**Guiones**\n\n**G-05 · Concubinato con el titular vivo**\n\n> *\"Usted y su señora no están casados. Si usted falta, ella tiene derecho al 90% de su pensión de por\n> vida, pero el IMSS le va a pedir una sentencia de juez, y usted ya no va a poder declarar a su\n> favor. Hoy, estando usted vivo, eso se resuelve más rápido y barato. Y si tuvieron hijos juntos,\n> tráigame las actas.\"*\n\n**G-07 · Beneficiarios**\n\n> *\"Una pregunta que le hago a todos: ¿ya designó beneficiarios en su Afore, y con qué porcentajes? Es\n> gratis, es una hoja, y le evita un juicio a su familia.\"*\n"
 },
 {
  "clave": "P1-05",
  "ruta": "P1",
  "titulo": "Devolución de vivienda Infonavit",
  "orden": 5,
  "duracion_min": 60,
  "version": 1,
  "parametros": [],
  "fuentes": [],
  "contenido": "**Gancho comercial:** *\"¿Ya se pensionó? ¿Nunca usó su crédito Infonavit? Entonces tiene dinero ahí,\nno caduca, y nadie se lo va a depositar si no lo pide.\"*\n\n- **Quién califica:** pensionado por el IMSS (vejez, cesantía o invalidez ≥ 50%), con saldo de\n  vivienda, **sin crédito Infonavit activo** y sin haber usado esos fondos.\n- **Tres bolsas distintas:** Fondo de Ahorro 1972-1992, Vivienda 92, Vivienda 97. Pedir las tres.\n- **Exenta de impuestos** (art. 36 Ley Infonavit). **Imprescriptible** (art. 37).\n- **Edad 70:** sin haberla reclamado (y sin relación laboral activa) pasa al Fondo de Pensiones para el\n  Bienestar, con mecanismo de devolución permanente y con intereses. **No se pierde.**\n- En Ley 73 se entrega en **una sola exhibición**.\n- **El trámite es gratuito y no requiere intermediarios.** Lo que vendemos es la **revisión\n  previa**: el 90% de los rechazos son porque NSS, CURP y RFC **no coinciden exactamente** entre IMSS,\n  Afore y banco, o porque el estado de cuenta bancario tiene **más de 2 meses**.\n\n\n**Guion**\n\n**G-06 · Gancho de vivienda**\n\n> *\"¿Ya se pensionó? ¿Nunca usó su crédito Infonavit? Entonces tiene dinero ahí, no caduca y no paga\n> impuestos, pero nadie se lo deposita si no lo pide.\"*\n"
 },
 {
  "clave": "P1-06",
  "ruta": "P1",
  "titulo": "ISSSTE y portabilidad",
  "orden": 6,
  "duracion_min": 60,
  "version": 1,
  "parametros": [],
  "fuentes": [],
  "contenido": "- **Quien trabaja hoy en el gobierno no está desempleado:** no hay retiro por desempleo ni del IMSS ni\n  del ISSSTE. *\"Si alguien le ofrece sacar su Afore mientras trabaja en el gobierno, es un fraude.\"*\n- **Dos regímenes en el ISSSTE:** Décimo Transitorio (\"ley vieja\", no porta con el IMSS) y cuentas\n  individuales (sí porta). Quien eligió el Bono en 2008 está en cuentas individuales para siempre.\n- **Portabilidad:** se pueden sumar semanas IMSS y años ISSSTE al llegar a la edad de pensión\n  (1 año = 52 semanas). Los periodos **simultáneos no se suman**. **No es automática: se solicita.**\n- **Ojo (art. 144):** con 25 años **solo en el ISSSTE** le toca la garantizada del ISSSTE (más alta\n  para salarios bajos y medios). Si completa los 25 con semanas del IMSS, le toca la del IMSS. La\n  portabilidad es **red de seguridad**, no primera opción.\n- **Servicio médico del pensionado mixto:** requiere 15 años en una institución o 24 en conjunto.\n\n**Tu trabajo aquí:** detectar el caso y pasarlo al Director con la Hoja Única de Servicios y la\nconstancia del IMSS que **genere el propio cliente**.\n"
 },
 {
  "clave": "P2-01",
  "ruta": "P2",
  "titulo": "Pensiones con problemas: préstamos, negativas y correcciones",
  "orden": 1,
  "duracion_min": 90,
  "version": 1,
  "parametros": [],
  "fuentes": [],
  "contenido": "**Descuentos por préstamos (Transitorio Vigésimo Noveno LSS):** el total de descuentos no puede\npasar de **30%** de la pensión, no puede dejarla debajo del **promedio de las pensiones garantizadas**\na 1 salario mínimo y 60 años, y el plazo no puede pasar de **60 meses**. Un pensionado que recibe\nunos cientos de pesos por préstamos está probablemente debajo del piso legal → reclamación al IMSS y\nqueja en CONDUSEF (lo arma el Director).\n\n**Negativa de pensión:**\n\n- **Recurso de inconformidad:** 15 días hábiles desde la notificación (art. 294 LSS). Ese plazo no se\n  perdona → alerta inmediata al Director.\n- **Juicio:** Tribunal Laboral Federal del lugar de la clínica del asegurado. Lo firma y lleva el\n  **abogado**; nosotros integramos expediente (art. 899-C LFT), calculamos y canalizamos.\n- Siempre conseguir el **acuse sellado** de la solicitud (sirve para impugnar el silencio del IMSS).\n\n**Corrección de pensiones mal calculadas — honestidad primero:** antes de ofrecer un \"retroactivo\",\nel Director revisa la hoja de cálculo de la resolución. Hay casos donde el IMSS calculó bien y la\npensión es baja porque subió por inflación y no por salario mínimo (criterio de la SCJN de 2024).\n**No se presenta como probable lo que solo se gana en juicio con riesgo alto.**\n"
 },
 {
  "clave": "P2-02",
  "ruta": "P2",
  "titulo": "Diagnóstico integral y presentación del plan",
  "orden": 2,
  "duracion_min": 120,
  "version": 1,
  "parametros": [],
  "fuentes": [],
  "contenido": "**Preguntas obligatorias en todo diagnóstico de pensión** (checklist del sistema):\n\n1. Régimen, semanas totales (cotizadas − descontadas + reintegradas), fecha de primera alta.\n2. Fecha de nacimiento → fechas de 60 y 65.\n3. Fecha de última baja → conservación de derechos, plazo de M40 (5 años), ventana M10 (12 meses).\n4. ¿Trabaja hoy? ¿Formal, independiente, gobierno?\n5. Estado de salud (para comparar invalidez — sin prometer dictamen).\n6. **Estado civil: casado o unión libre.** ¿Hijos en común? Edad de él al casarse.\n7. **¿Designó beneficiarios en la Afore?**\n8. ¿Tuvo crédito Infonavit? ¿Qué firmó al \"traspasar\" la casa? (una cesión ante notario no libera el\n   crédito)\n9. ¿Préstamos descontados de la pensión? (si ya es pensionado)\n10. ¿Retiros previos de la Afore? ¿Aportaciones voluntarias?\n11. ¿Cotizó alguna vez al ISSSTE?\n\n**Presentación del plan (junto con el Director):** comparativo de rutas (cesantía, invalidez, vejez,\nM40, M10/PTI), lo que cuesta cada una, lo que deja a la familia y las fechas límite. Siempre se dice\n**\"estimado\"**.\n"
 }
];

export const PREGUNTAS: Pregunta[] = [
 {
  "clave": "N0-Q01",
  "critica": true,
  "tipo": "opcion_multiple",
  "enunciado": "Un cliente te pregunta si le garantizas que va a recibir $15,000. ¿Qué respondes?",
  "opciones": [
   "\"Sí, te lo garantizo.\"",
   "\"Es un estimado; el monto final lo determina la Afore. Te enseño lo que recibirías y las semanas que pierdes.\"",
   "\"Seguro te dan más.\"",
   "\"Eso no te lo puedo decir.\""
  ],
  "correcta": 1,
  "tolerancia": null,
  "explicacion": "nunca prometemos montos; todo cálculo es estimado y va con su costo en semanas.",
  "parametros": [],
  "modulo": "N0-02",
  "version": 1
 },
 {
  "clave": "N0-Q02",
  "critica": true,
  "tipo": "opcion_multiple",
  "enunciado": "El cliente te manda su usuario y contraseña de AforeWeb \"para agilizar\".",
  "opciones": [
   "Los guardas en las notas del CRM.",
   "Los usas una vez y los borras.",
   "Le pides que no los comparta y que él capture en el portal; nunca se guardan ni usan contraseñas de terceros.",
   "Se los reenvías al Director."
  ],
  "correcta": 2,
  "tolerancia": null,
  "explicacion": "línea roja 2.",
  "parametros": [],
  "modulo": "N0-02",
  "version": 1
 },
 {
  "clave": "N0-Q03",
  "critica": true,
  "tipo": "opcion_multiple",
  "enunciado": "Un prospecto te pide \"subirle el salario\" en su registro para retirar más.",
  "opciones": [
   "Le dices que lo consultas.",
   "Lo rechazas: la empresa no altera salarios ni crea patrones ficticios.",
   "Lo canalizas con un gestor.",
   "Lo haces si paga más honorario."
  ],
  "correcta": 1,
  "tolerancia": null,
  "explicacion": "línea roja 3.",
  "parametros": [],
  "modulo": "N0-02",
  "version": 1
 },
 {
  "clave": "N0-Q04",
  "critica": false,
  "tipo": "opcion_multiple",
  "enunciado": "¿El trámite de retiro por desempleo ante la Afore tiene costo?",
  "opciones": [
   "Sí, lo cobra la Afore.",
   "Es gratuito y personal; nosotros cobramos por asesoría, cálculo, expediente y acompañamiento.",
   "Solo es gratuito si lo hace una firma."
  ],
  "correcta": 1,
  "tolerancia": null,
  "explicacion": "así se vende sin riesgo frente a PROFECO y CONDUSEF.",
  "parametros": [],
  "modulo": "N0-01",
  "version": 1
 },
 {
  "clave": "N0-Q05",
  "critica": true,
  "tipo": "opcion_multiple",
  "enunciado": "¿Cuál es la primera pregunta de diagnóstico en cualquier tema de pensión?",
  "opciones": [
   "¿Cuánto dinero quiere?",
   "¿Cotizó antes del 1 de julio de 1997? (Ley 73 o Ley 97)",
   "¿En qué Afore está?"
  ],
  "correcta": 1,
  "tolerancia": null,
  "explicacion": "si se equivoca el régimen, todo lo demás sale mal.",
  "parametros": [],
  "modulo": "N0-03",
  "version": 1
 },
 {
  "clave": "N0-Q06",
  "critica": false,
  "tipo": "opcion_multiple",
  "enunciado": "El honorario del retiro por desempleo es:",
  "opciones": [
   "26% más IVA.",
   "30% de lo que paga la Afore, IVA incluido.",
   "Una cuota fija."
  ],
  "correcta": 1,
  "tolerancia": null,
  "explicacion": null,
  "parametros": [
   "HONORARIO_RETIRO_PCT",
   "IVA"
  ],
  "modulo": "N0-01",
  "version": 1
 },
 {
  "clave": "N0-Q07",
  "critica": false,
  "tipo": "opcion_multiple",
  "enunciado": "¿Qué subcuenta NO entra en el cálculo del retiro?",
  "opciones": [
   "RCV.",
   "Vivienda.",
   "Ninguna, entra todo."
  ],
  "correcta": 1,
  "tolerancia": null,
  "explicacion": null,
  "parametros": [],
  "modulo": "N0-03",
  "version": 1
 },
 {
  "clave": "N0-Q08",
  "critica": false,
  "tipo": "opcion_multiple",
  "enunciado": "La Afore deposita $10,000 en un retiro tuyo. Honorario 30% = $3,000; costo administrativo del alta $500; tu porcentaje es 40%. ¿Cuál es tu comisión?",
  "opciones": [
   "$500.",
   "$1,000.",
   "$1,200."
  ],
  "correcta": 1,
  "tolerancia": null,
  "explicacion": "(honorario − costo del alta) × tu % = ($3,000 − $500) × 40% = $1,000, el total de tu factura con IVA. Se devenga cuando la Afore paga y se cobra el honorario.",
  "parametros": [
   "HONORARIO_RETIRO_PCT",
   "COSTO_ADMIN_ALTA",
   "BASE_REPARTO_SOCIO"
  ],
  "modulo": "N0-01",
  "version": 1
 },
 {
  "clave": "N0-Q09",
  "critica": false,
  "tipo": "opcion_multiple",
  "enunciado": "Un cliente que trabaja en una dependencia de gobierno te dice que su constancia del IMSS muestra baja en 2011. ¿Puede hacer retiro por desempleo?",
  "opciones": [
   "Sí, por la baja del IMSS.",
   "No: tiene relación laboral vigente.",
   "Sí, si espera 46 días."
  ],
  "correcta": 1,
  "tolerancia": null,
  "explicacion": null,
  "parametros": [],
  "modulo": "N0-03",
  "version": 1
 },
 {
  "clave": "R1-Q01",
  "critica": true,
  "tipo": "opcion_multiple",
  "enunciado": "Fecha de baja: 1 de octubre de 2026. ¿Desde qué fecha se puede solicitar el retiro según el criterio de la casa?",
  "opciones": [
   "16 de noviembre de 2026",
   "1 de noviembre de 2026",
   "15 de noviembre de 2026"
  ],
  "correcta": 0,
  "tolerancia": null,
  "explicacion": null,
  "parametros": [
   "DIAS_ESPERA_DESEMPLEO"
  ],
  "modulo": "R1-01",
  "version": 1
 },
 {
  "clave": "R1-Q02",
  "critica": true,
  "tipo": "opcion_multiple",
  "enunciado": "Requisitos de la modalidad A:",
  "opciones": [
   "Cuenta con 5 años.",
   "Cuenta con 3 años de abierta y 12 bimestres de cotización.",
   "104 semanas cotizadas."
  ],
  "correcta": 1,
  "tolerancia": null,
  "explicacion": null,
  "parametros": [],
  "modulo": "R1-01",
  "version": 1
 },
 {
  "clave": "R1-Q03",
  "critica": false,
  "tipo": "opcion_multiple",
  "enunciado": "La modalidad B paga:",
  "opciones": [
   "30 días del último SBC.",
   "Lo menor entre 90 días del SBC promedio de 250 semanas y el 11.5% del saldo RCV.",
   "Lo mayor entre ambos."
  ],
  "correcta": 1,
  "tolerancia": null,
  "explicacion": null,
  "parametros": [],
  "modulo": "R1-01",
  "version": 1
 },
 {
  "clave": "R1-Q04",
  "critica": false,
  "tipo": "numerica",
  "enunciado": "Califica solo a A. SBC último $500, saldo RCV $100,000. Monto estimado:",
  "opciones": [],
  "correcta": 15000,
  "tolerancia": 0,
  "explicacion": null,
  "parametros": [
   "UMA_MENSUAL"
  ],
  "modulo": "R1-02",
  "version": 1
 },
 {
  "clave": "R1-Q05",
  "critica": false,
  "tipo": "numerica",
  "enunciado": "Mismo cliente, 400 semanas. ¿Cuántas semanas pierde?",
  "opciones": [],
  "correcta": 60,
  "tolerancia": 0.1,
  "explicacion": null,
  "parametros": [],
  "modulo": "R1-03",
  "version": 1
 },
 {
  "clave": "R1-Q06",
  "critica": false,
  "tipo": "opcion_multiple",
  "enunciado": "Califica a A con SBC último de $2,000 diarios. Monto estimado en 2026:",
  "opciones": [
   "$60,000",
   "$35,662.20",
   "$30,000"
  ],
  "correcta": 1,
  "tolerancia": null,
  "explicacion": null,
  "parametros": [
   "UMA_MENSUAL"
  ],
  "modulo": "R1-02",
  "version": 1
 },
 {
  "clave": "R1-Q07",
  "critica": false,
  "tipo": "opcion_multiple",
  "enunciado": "Un cliente califica a A y B. ¿Quién elige?",
  "opciones": [
   "La Afore.",
   "El trabajador; la ley le permite optar por A aunque califique a B.",
   "Siempre se paga B."
  ],
  "correcta": 1,
  "tolerancia": null,
  "explicacion": null,
  "parametros": [],
  "modulo": "R1-01",
  "version": 1
 },
 {
  "clave": "R1-Q08",
  "critica": true,
  "tipo": "opcion_multiple",
  "enunciado": "¿Cómo se verifica que no haya retirado en los últimos 5 años?",
  "opciones": [
   "Con la constancia de semanas.",
   "Con el estado de cuenta de la Afore.",
   "Preguntándole al cliente."
  ],
  "correcta": 1,
  "tolerancia": null,
  "explicacion": "la constancia muestra semanas descontadas pero no la fecha.",
  "parametros": [],
  "modulo": "R1-04",
  "version": 1
 },
 {
  "clave": "R1-Q09",
  "critica": false,
  "tipo": "opcion_multiple",
  "enunciado": "La constancia muestra 41 semanas descontadas y no tienes el estado de cuenta. ¿Qué resultado corresponde si todo lo demás cumple?",
  "opciones": [
   "`APTO`",
   "`APTO_BLOQUEADO` hasta verificar la fecha del último retiro.",
   "`NO_ELEGIBLE_DEFINITIVO`"
  ],
  "correcta": 1,
  "tolerancia": null,
  "explicacion": null,
  "parametros": [],
  "modulo": "R1-05",
  "version": 1
 },
 {
  "clave": "R1-Q10",
  "critica": false,
  "tipo": "opcion_multiple",
  "enunciado": "Constancia en ceros con NSS asignado. ¿Qué investigas?",
  "opciones": [
   "Nada, se archiva.",
   "Posible NSS duplicado, cotización en ISSSTE o que nunca cotizó formalmente; preguntas si trabajó con recibo de nómina y en qué sector.",
   "Que la Afore se equivocó."
  ],
  "correcta": 1,
  "tolerancia": null,
  "explicacion": null,
  "parametros": [],
  "modulo": "R1-04",
  "version": 1
 },
 {
  "clave": "R1-Q11",
  "critica": false,
  "tipo": "opcion_multiple",
  "enunciado": "El portal bloquea al cliente por biometría. ¿Cómo se agenda la cita?",
  "opciones": [
   "Como \"Retiro parcial por desempleo\".",
   "Como \"Expediente de Identificación (IDE)\".",
   "No se agenda; se espera."
  ],
  "correcta": 1,
  "tolerancia": null,
  "explicacion": null,
  "parametros": [],
  "modulo": "R1-06",
  "version": 1
 },
 {
  "clave": "R1-Q12",
  "critica": false,
  "tipo": "opcion_multiple",
  "enunciado": "¿Qué cuenta bancaria se pide?",
  "opciones": [
   "Cualquiera a nombre del cliente.",
   "Nivel 4, sin límite de depósitos, a nombre del cliente; las solo digitales suelen fallar.",
   "La tuya, y luego le transfieres."
  ],
  "correcta": 1,
  "tolerancia": null,
  "explicacion": null,
  "parametros": [],
  "modulo": "R1-06",
  "version": 1
 },
 {
  "clave": "R1-Q13",
  "critica": false,
  "tipo": "opcion_multiple",
  "enunciado": "Antigüedad máxima del comprobante de domicilio:",
  "opciones": [
   "6 meses",
   "3 meses",
   "1 año"
  ],
  "correcta": 1,
  "tolerancia": null,
  "explicacion": null,
  "parametros": [],
  "modulo": "R1-06",
  "version": 1
 },
 {
  "clave": "R1-Q14",
  "critica": false,
  "tipo": "opcion_multiple",
  "enunciado": "La foto de la INE que sube el cliente pesa 120 KB. ¿Qué pasa en el sistema?",
  "opciones": [
   "No se puede subir.",
   "Se sube con aviso; quien valida revisa que se lea bien antes de validarla.",
   "Se rechaza siempre."
  ],
  "correcta": 1,
  "tolerancia": null,
  "explicacion": "Desde el 10 de noviembre una foto ligera ya no se bloquea: se sube con aviso y se revisa antes de validarla.",
  "parametros": [],
  "modulo": "R1-06",
  "version": 1
 },
 {
  "clave": "R1-Q15",
  "critica": true,
  "tipo": "opcion_multiple",
  "enunciado": "¿Qué plazo de ingreso le prometes al cliente?",
  "opciones": [
   "\"En 30 días ya tienes tu dinero.\"",
   "Ingresamos en máximo 15 días hábiles desde que el expediente está completo; la Afore tiene 5 días hábiles para resolver.",
   "\"Mañana mismo.\""
  ],
  "correcta": 1,
  "tolerancia": null,
  "explicacion": null,
  "parametros": [
   "SLA_DIAS_HABILES",
   "AFORE_DIAS_HABILES"
  ],
  "modulo": "R1-06",
  "version": 1
 },
 {
  "clave": "R1-Q16",
  "critica": false,
  "tipo": "opcion_multiple",
  "enunciado": "Un colega te enseña la Circular CONSAR 31-10 que dice \"75 días y 10%\". ¿Qué haces?",
  "opciones": [
   "Usas esos números.",
   "Aplicas la LSS reformada en mayo de 2009: 90 días y 11.5%.",
   "Promedias."
  ],
  "correcta": 1,
  "tolerancia": null,
  "explicacion": null,
  "parametros": [],
  "modulo": "R1-02",
  "version": 1
 },
 {
  "clave": "R1-Q17",
  "critica": false,
  "tipo": "opcion_multiple",
  "enunciado": "El 11.5% se calcula sobre:",
  "opciones": [
   "El saldo total de la cuenta.",
   "El saldo RCV sin SAR 92.",
   "RCV más vivienda."
  ],
  "correcta": 1,
  "tolerancia": null,
  "explicacion": null,
  "parametros": [],
  "modulo": "R1-02",
  "version": 1
 },
 {
  "clave": "R1-Q18",
  "critica": false,
  "tipo": "opcion_multiple",
  "enunciado": "El retiro estimado es de $2,500. ¿Se toma el caso?",
  "opciones": [
   "No, es menor al mínimo.",
   "Sí: no hay monto mínimo de retiro, siempre que le convenga al cliente.",
   "Solo si paga honorario fijo."
  ],
  "correcta": 1,
  "tolerancia": null,
  "explicacion": null,
  "parametros": [],
  "modulo": "R1-05",
  "version": 1
 },
 {
  "clave": "R1-Q19",
  "critica": false,
  "tipo": "opcion_multiple",
  "enunciado": "¿Cómo se paga la modalidad B?",
  "opciones": [
   "En una exhibición.",
   "Hasta 6 mensualidades; si se reincorpora a trabajar, se suspenden las siguientes.",
   "En 12 meses."
  ],
  "correcta": 1,
  "tolerancia": null,
  "explicacion": null,
  "parametros": [],
  "modulo": "R1-01",
  "version": 1
 },
 {
  "clave": "R1-Q20",
  "critica": false,
  "tipo": "opcion_multiple",
  "enunciado": "¿Las semanas descontadas por el retiro se pueden recuperar?",
  "opciones": [
   "No, nunca.",
   "Sí, reintegrando el dinero, de forma proporcional.",
   "Sí, automáticamente al volver a trabajar."
  ],
  "correcta": 1,
  "tolerancia": null,
  "explicacion": null,
  "parametros": [],
  "modulo": "R1-03",
  "version": 1
 },
 {
  "clave": "R2-Q01",
  "critica": true,
  "tipo": "opcion_multiple",
  "enunciado": "Ley 97, cumple 60 en 2028 (mínimo 925), tiene 950 semanas y el retiro le quita 40. Resultado:",
  "opciones": [
   "`APTO`, porque tiene más de 925 hoy.",
   "`CALIFICA_NO_CONVIENE`: quedaría con 910, debajo del mínimo; se ofrece asesoría de pensión.",
   "`NO_TODAVIA`"
  ],
  "correcta": 1,
  "tolerancia": null,
  "explicacion": null,
  "parametros": [],
  "modulo": "R2-01",
  "version": 1
 },
 {
  "clave": "R2-Q02",
  "critica": false,
  "tipo": "opcion_multiple",
  "enunciado": "Ley 73 con 900 semanas; el retiro le quita 30. ¿Qué pierde?",
  "opciones": [
   "Nada, sigue arriba de 500.",
   "Un incremento anual de su pensión (de 8 a 7), de por vida.",
   "La pensión completa."
  ],
  "correcta": 1,
  "tolerancia": null,
  "explicacion": null,
  "parametros": [],
  "modulo": "R2-01",
  "version": 1
 },
 {
  "clave": "R2-Q03",
  "critica": true,
  "tipo": "opcion_multiple",
  "enunciado": "¿Cuántas semanas necesita un cliente **Ley 73** que se pensiona en 2026?",
  "opciones": [
   "875",
   "500",
   "1,000"
  ],
  "correcta": 1,
  "tolerancia": null,
  "explicacion": null,
  "parametros": [],
  "modulo": "R2-01",
  "version": 1
 },
 {
  "clave": "R2-Q04",
  "critica": false,
  "tipo": "opcion_multiple",
  "enunciado": "El cliente necesita dinero pero no puede perder semanas. ¿Qué revisas primero?",
  "opciones": [
   "Un préstamo.",
   "Sus aportaciones voluntarias: se retiran sin costo en semanas.",
   "La modalidad B."
  ],
  "correcta": 1,
  "tolerancia": null,
  "explicacion": null,
  "parametros": [],
  "modulo": "R2-02",
  "version": 1
 },
 {
  "clave": "R2-Q05",
  "critica": false,
  "tipo": "opcion_multiple",
  "enunciado": "Cliente Ley 73 de 58 años quiere retirar. ¿Qué haces?",
  "opciones": [
   "Cierras el retiro.",
   "Lo desvías a asesoría de pensión: el sistema marca `NO_ELEGIBLE_DESVIO` o pide análisis de impacto.",
   "Le dices que espere a los 60 para retirar."
  ],
  "correcta": 1,
  "tolerancia": null,
  "explicacion": null,
  "parametros": [],
  "modulo": "R2-02",
  "version": 1
 },
 {
  "clave": "R2-Q06",
  "critica": false,
  "tipo": "opcion_multiple",
  "enunciado": "\"¿Me quedo sin seguro médico?\" (tenía 2 años cotizando seguidos)",
  "opciones": [
   "Sí, desde el día de la baja.",
   "Conserva 8 semanas de atención médica, él y sus beneficiarios.",
   "Conserva 1 año."
  ],
  "correcta": 1,
  "tolerancia": null,
  "explicacion": null,
  "parametros": [],
  "modulo": "R2-02",
  "version": 1
 },
 {
  "clave": "P1-Q01",
  "critica": true,
  "tipo": "opcion_multiple",
  "enunciado": "Cliente Ley 73 de 63 años con padecimiento crónico quiere firmar cesantía hoy. ¿Qué le adviertes?",
  "opciones": [
   "Nada, es su derecho.",
   "Que firmar cesantía cierra para siempre la invalidez y la vejez; antes hay que comparar las tres rutas.",
   "Que mejor espere a los 70."
  ],
  "correcta": 1,
  "tolerancia": null,
  "explicacion": null,
  "parametros": [],
  "modulo": "P1-01",
  "version": 1
 },
 {
  "clave": "P1-Q02",
  "critica": false,
  "tipo": "opcion_multiple",
  "enunciado": "La cesantía a los 60 paga:",
  "opciones": [
   "100% de la vejez.",
   "75% de la vejez.",
   "90% de la vejez."
  ],
  "correcta": 1,
  "tolerancia": null,
  "explicacion": null,
  "parametros": [],
  "modulo": "P1-01",
  "version": 1
 },
 {
  "clave": "P1-Q03",
  "critica": false,
  "tipo": "opcion_multiple",
  "enunciado": "Cliente Ley 73 cuya cuantía calculada queda debajo del piso. ¿A qué edad conviene pensionarse?",
  "opciones": [
   "A los 65, porque cobra más.",
   "A los 60: en el piso cobra lo mismo a los 60 que a los 65 (debe quedar sin trabajo remunerado).",
   "Da igual cuándo."
  ],
  "correcta": 1,
  "tolerancia": null,
  "explicacion": null,
  "parametros": [],
  "modulo": "P1-01",
  "version": 1
 },
 {
  "clave": "P1-Q04",
  "critica": false,
  "tipo": "opcion_multiple",
  "enunciado": "Pensionado en el piso con esposa y dos hijos menores. ¿Cobra asignaciones familiares encima del piso?",
  "opciones": [
   "Sí, 35% más.",
   "No: las asignaciones quedan dentro del piso.",
   "Solo la de la esposa."
  ],
  "correcta": 1,
  "tolerancia": null,
  "explicacion": null,
  "parametros": [],
  "modulo": "P1-01",
  "version": 1
 },
 {
  "clave": "P1-Q05",
  "critica": true,
  "tipo": "opcion_multiple",
  "enunciado": "¿La Modalidad 40 da servicio médico?",
  "opciones": [
   "Sí.",
   "No: solo invalidez y vida y RCV. Si necesita atención médica, la vía es M10."
  ],
  "correcta": 1,
  "tolerancia": null,
  "explicacion": null,
  "parametros": [],
  "modulo": "P1-03",
  "version": 1
 },
 {
  "clave": "P1-Q06",
  "critica": true,
  "tipo": "opcion_multiple",
  "enunciado": "¿Qué pasa si el cliente de M40 deja de pagar 2 meses?",
  "opciones": [
   "Nada.",
   "Causa baja; tiene 12 meses para pedir el reingreso.",
   "Pierde todas sus semanas."
  ],
  "correcta": 1,
  "tolerancia": null,
  "explicacion": null,
  "parametros": [],
  "modulo": "P1-03",
  "version": 1
 },
 {
  "clave": "P1-Q07",
  "critica": false,
  "tipo": "opcion_multiple",
  "enunciado": "Plazo para solicitar M40:",
  "opciones": [
   "Cuando quiera.",
   "Dentro de 5 años desde la baja, con 52 semanas en los últimos 5 años.",
   "Dentro de 12 meses."
  ],
  "correcta": 1,
  "tolerancia": null,
  "explicacion": null,
  "parametros": [],
  "modulo": "P1-03",
  "version": 1
 },
 {
  "clave": "P1-Q08",
  "critica": false,
  "tipo": "opcion_multiple",
  "enunciado": "¿A quién le conviene M40?",
  "opciones": [
   "A cualquiera.",
   "Principalmente a Ley 73, porque sube el promedio de las últimas 250 semanas.",
   "Principalmente a Ley 97."
  ],
  "correcta": 1,
  "tolerancia": null,
  "explicacion": null,
  "parametros": [],
  "modulo": "P1-03",
  "version": 1
 },
 {
  "clave": "P1-Q09",
  "critica": false,
  "tipo": "opcion_multiple",
  "enunciado": "Ventana para entrar a M10 sin examen médico ni tiempos de espera:",
  "opciones": [
   "5 años desde la baja.",
   "12 meses desde la baja, con 52 semanas previas.",
   "No existe."
  ],
  "correcta": 1,
  "tolerancia": null,
  "explicacion": null,
  "parametros": [],
  "modulo": "P1-03",
  "version": 1
 },
 {
  "clave": "P1-Q10",
  "critica": true,
  "tipo": "opcion_multiple",
  "enunciado": "Una mujer embarazada quiere inscribirse a M10 para que le atiendan el parto.",
  "opciones": [
   "Le dices que sí la cubren.",
   "Le adviertes que el parto tiene 10 meses de espera y se lo dejas por escrito.",
   "Le recomiendas M40."
  ],
  "correcta": 1,
  "tolerancia": null,
  "explicacion": null,
  "parametros": [],
  "modulo": "P1-03",
  "version": 1
 },
 {
  "clave": "P1-Q11",
  "critica": false,
  "tipo": "opcion_multiple",
  "enunciado": "La pensión de viudez Ley 73 es:",
  "opciones": [
   "50% de la pensión del finado.",
   "90%.",
   "100%."
  ],
  "correcta": 1,
  "tolerancia": null,
  "explicacion": null,
  "parametros": [],
  "modulo": "P1-04",
  "version": 1
 },
 {
  "clave": "P1-Q12",
  "critica": true,
  "tipo": "opcion_multiple",
  "enunciado": "Para acreditar concubinato, el IMSS pide:",
  "opciones": [
   "Carta del ayudante municipal.",
   "Acta ante notario con dos testigos.",
   "Copia certificada de la sentencia del Juzgado Familiar y del auto que la declara ejecutoriada."
  ],
  "correcta": 2,
  "tolerancia": null,
  "explicacion": null,
  "parametros": [],
  "modulo": "P1-04",
  "version": 1
 },
 {
  "clave": "P1-Q13",
  "critica": false,
  "tipo": "opcion_multiple",
  "enunciado": "¿Qué efecto tiene un hijo en común en la viudez?",
  "opciones": [
   "Ninguno.",
   "Sustituye la prueba de 5 años de concubinato y anula las limitaciones del art. 154.",
   "Solo sirve para la orfandad."
  ],
  "correcta": 1,
  "tolerancia": null,
  "explicacion": null,
  "parametros": [],
  "modulo": "P1-04",
  "version": 1
 },
 {
  "clave": "P1-Q14",
  "critica": false,
  "tipo": "opcion_multiple",
  "enunciado": "Pensionado Ley 73 de 62 años, sin hijos con su pareja, se casa hoy. ¿Desde cuándo queda protegida la viudez?",
  "opciones": [
   "Desde hoy.",
   "Cuando cumplan 1 año de casados.",
   "A los 6 meses."
  ],
  "correcta": 1,
  "tolerancia": null,
  "explicacion": null,
  "parametros": [],
  "modulo": "P1-04",
  "version": 1
 },
 {
  "clave": "P1-Q15",
  "critica": true,
  "tipo": "opcion_multiple",
  "enunciado": "El esposo murió hace 3 años y la viuda nunca pidió la pensión. ¿Qué le dices?",
  "opciones": [
   "Que ya prescribió.",
   "Que el derecho no prescribe pero solo se pagan los últimos 12 meses: hay que solicitar ya.",
   "Que le pagan los 3 años completos."
  ],
  "correcta": 1,
  "tolerancia": null,
  "explicacion": null,
  "parametros": [],
  "modulo": "P1-04",
  "version": 1
 },
 {
  "clave": "P1-Q16",
  "critica": false,
  "tipo": "opcion_multiple",
  "enunciado": "El finado no designó beneficiarios en su Afore. ¿Qué pasa con el saldo?",
  "opciones": [
   "Se pierde.",
   "Se entrega según el orden del art. 501 LFT, muchas veces con juicio.",
   "Se queda la Afore."
  ],
  "correcta": 1,
  "tolerancia": null,
  "explicacion": null,
  "parametros": [],
  "modulo": "P1-04",
  "version": 1
 },
 {
  "clave": "P1-Q17",
  "critica": false,
  "tipo": "opcion_multiple",
  "enunciado": "Devolución de vivienda: ¿qué pasa si el pensionado cumple 70 sin reclamarla?",
  "opciones": [
   "La pierde.",
   "Pasa al Fondo de Pensiones para el Bienestar; no se pierde y se puede reclamar con intereses.",
   "Se queda el Infonavit."
  ],
  "correcta": 1,
  "tolerancia": null,
  "explicacion": null,
  "parametros": [],
  "modulo": "P1-05",
  "version": 1
 },
 {
  "clave": "P1-Q18",
  "critica": false,
  "tipo": "opcion_multiple",
  "enunciado": "¿La devolución de vivienda paga ISR?",
  "opciones": [
   "Sí, 10%.",
   "No, está exenta."
  ],
  "correcta": 1,
  "tolerancia": null,
  "explicacion": null,
  "parametros": [],
  "modulo": "P1-05",
  "version": 1
 },
 {
  "clave": "P1-Q19",
  "critica": false,
  "tipo": "opcion_multiple",
  "enunciado": "¿Cuál es el filtro que más clientes descarta en la devolución de vivienda?",
  "opciones": [
   "La edad.",
   "Tener crédito Infonavit activo o haber usado los fondos en un crédito.",
   "La Afore."
  ],
  "correcta": 1,
  "tolerancia": null,
  "explicacion": null,
  "parametros": [],
  "modulo": "P1-05",
  "version": 1
 },
 {
  "clave": "P1-Q20",
  "critica": false,
  "tipo": "opcion_multiple",
  "enunciado": "¿Se suman los periodos en que cotizó al IMSS y al ISSSTE al mismo tiempo?",
  "opciones": [
   "Sí, cuentan doble.",
   "No, el tiempo simultáneo no se suma."
  ],
  "correcta": 1,
  "tolerancia": null,
  "explicacion": null,
  "parametros": [],
  "modulo": "P1-06",
  "version": 1
 },
 {
  "clave": "P1-Q21",
  "critica": true,
  "tipo": "opcion_multiple",
  "enunciado": "Una señora te dice: \"Me dijeron que la Corte ya quitó los 5 años de concubinato.\" ¿Qué respondes?",
  "opciones": [
   "\"Sí, ya no los piden.\"",
   "\"En ventanilla los siguen pidiendo; si se lo niegan por el tiempo, hay con qué pelearlo, con abogado y con plazos.\"",
   "\"Eso es falso.\""
  ],
  "correcta": 1,
  "tolerancia": null,
  "explicacion": null,
  "parametros": [],
  "modulo": "P1-04",
  "version": 1
 },
 {
  "clave": "P1-Q22",
  "critica": false,
  "tipo": "opcion_multiple",
  "enunciado": "¿Qué modalidad de pensión Ley 97 deja saldo heredable?",
  "opciones": [
   "Renta vitalicia.",
   "Retiro programado."
  ],
  "correcta": 1,
  "tolerancia": null,
  "explicacion": null,
  "parametros": [],
  "modulo": "P1-02",
  "version": 1
 },
 {
  "clave": "P2-Q01",
  "critica": true,
  "tipo": "opcion_multiple",
  "enunciado": "El IMSS notificó una negativa. ¿Cuál es el plazo del recurso de inconformidad?",
  "opciones": [
   "15 días hábiles desde la notificación.",
   "2 años.",
   "No hay plazo."
  ],
  "correcta": 0,
  "tolerancia": null,
  "explicacion": null,
  "parametros": [],
  "modulo": "P2-01",
  "version": 1
 },
 {
  "clave": "P2-Q02",
  "critica": false,
  "tipo": "opcion_multiple",
  "enunciado": "¿Quién firma y lleva la demanda contra el IMSS?",
  "opciones": [
   "El asesor de pensiones.",
   "El abogado; la firma integra el expediente y canaliza."
  ],
  "correcta": 1,
  "tolerancia": null,
  "explicacion": null,
  "parametros": [],
  "modulo": "P2-01",
  "version": 1
 },
 {
  "clave": "P2-Q03",
  "critica": false,
  "tipo": "opcion_multiple",
  "enunciado": "Pensionado desde 2013 cobra menos que el piso de 2026 y quiere que se lo \"nivelen\".",
  "opciones": [
   "Le prometes el retroactivo.",
   "Le explicas que el piso aplica a pensiones otorgadas ese año y las demás suben por inflación; el Director y el abogado revisan si hay algo que reclamar, sin prometer."
  ],
  "correcta": 1,
  "tolerancia": null,
  "explicacion": null,
  "parametros": [],
  "modulo": "P2-01",
  "version": 1
 },
 {
  "clave": "P2-Q04",
  "critica": false,
  "tipo": "opcion_multiple",
  "enunciado": "Límite legal de descuentos por préstamos sobre una pensión:",
  "opciones": [
   "50% y sin plazo.",
   "30% en total, sin dejarla debajo del piso de garantizadas, y plazo máximo de 60 meses."
  ],
  "correcta": 1,
  "tolerancia": null,
  "explicacion": null,
  "parametros": [],
  "modulo": "P2-01",
  "version": 1
 }
];

export const CASOS: CasoPractico[] = [
 {
  "clave": "C-R01",
  "ruta": "R1",
  "tipo": "retiro",
  "titulo": "Ley 97 con todo en regla",
  "narrativa": "Cliente Ley 97 de 36 años. Lo dieron de baja hace 60 días y no trabaja. Trae su constancia y su estado de cuenta: la cuenta tiene 4 años, 20 bimestres cotizados, último SBC de $500 diarios, saldo RCV de $100,000 y 400 semanas. Nunca ha retirado. IDE vigente y cuenta registrada.",
  "hoy": "2026-11-12",
  "datos": {
   "sbcUltimo": 500,
   "sbcPromedio250": null,
   "saldoRcv": 100000,
   "bimestres": 20,
   "antiguedadAnios": 4,
   "semanasTotales": 400,
   "regimen": "L97",
   "fechaNacimiento": "1990-05-10",
   "fechaBaja": "2026-09-13",
   "cotizaActualmente": false,
   "fechaAperturaCuenta": "2022-10-01",
   "estadoUltimoRetiro": "nunca_retiro",
   "fechaUltimoRetiro": null,
   "ideVigente": true,
   "tipoCuenta": "registrada",
   "saldoVoluntarias": 0
  },
  "captura": [
   "resultado",
   "montoA",
   "semanasA",
   "honorario"
  ],
  "explicacion": "APTO, solo modalidad A: 30 × $500 = $15,000. Pierde 15,000 ÷ (100,000 ÷ 400) = 60 semanas (le quedan 340, 15% del saldo). Honorario 30% = $4,500 (subtotal $3,879.31 + IVA $620.69). Tu comisión: ($4,500 − $500 del alta) × 40% = $1,600.",
  "esperado": {
   "resultado": "APTO",
   "montoA": 15000,
   "semanasA": 60,
   "honorario": 4500
  },
  "version": 1
 },
 {
  "clave": "C-R02",
  "ruta": "R1",
  "tipo": "retiro",
  "titulo": "Salario alto: el tope de 10 UMA",
  "narrativa": "Cliente Ley 97 de 36 años, baja hace 60 días. Cuenta de 4 años, 30 bimestres, último SBC de $2,000 diarios, saldo RCV de $300,000 y 600 semanas. Nunca ha retirado; IDE vigente y cuenta registrada.",
  "hoy": "2026-11-12",
  "datos": {
   "sbcUltimo": 2000,
   "sbcPromedio250": null,
   "saldoRcv": 300000,
   "bimestres": 30,
   "antiguedadAnios": 4,
   "semanasTotales": 600,
   "regimen": "L97",
   "fechaNacimiento": "1990-05-10",
   "fechaBaja": "2026-09-13",
   "cotizaActualmente": false,
   "fechaAperturaCuenta": "2022-10-01",
   "estadoUltimoRetiro": "nunca_retiro",
   "fechaUltimoRetiro": null,
   "ideVigente": true,
   "tipoCuenta": "registrada",
   "saldoVoluntarias": 0
  },
  "captura": [
   "resultado",
   "montoA",
   "semanasA"
  ],
  "explicacion": "30 × $2,000 = $60,000, pero la modalidad A tiene tope de 10 UMA mensuales = $35,662.20 (2026). Pierde 35,662.20 × 600 ÷ 300,000 = 71.3 semanas.",
  "esperado": {
   "resultado": "APTO",
   "montoA": 35662.2,
   "semanasA": 71.3
  },
  "version": 1
 },
 {
  "clave": "C-R03",
  "ruta": "R1",
  "tipo": "retiro",
  "titulo": "Califica a A y a B",
  "narrativa": "Cliente Ley 97 de 41 años, baja hace 60 días. Cuenta de 12 años con 70 bimestres, último SBC $650, SBC promedio de 250 semanas $600, saldo RCV $180,000 y 820 semanas. Nunca ha retirado; IDE vigente y cuenta registrada.",
  "hoy": "2026-11-12",
  "datos": {
   "sbcUltimo": 650,
   "sbcPromedio250": 600,
   "saldoRcv": 180000,
   "bimestres": 70,
   "antiguedadAnios": 12,
   "semanasTotales": 820,
   "regimen": "L97",
   "fechaNacimiento": "1985-02-20",
   "fechaBaja": "2026-09-13",
   "cotizaActualmente": false,
   "fechaAperturaCuenta": "2014-08-01",
   "estadoUltimoRetiro": "nunca_retiro",
   "fechaUltimoRetiro": null,
   "ideVigente": true,
   "tipoCuenta": "registrada",
   "saldoVoluntarias": 0
  },
  "captura": [
   "resultado",
   "montoA",
   "semanasA",
   "montoB",
   "semanasB",
   "modalidadMenosSemanas"
  ],
  "explicacion": "A = 30 × $650 = $19,500 (pierde 88.8). B = menor($54,000; 11.5% × $180,000 = $20,700) = $20,700 (pierde 94.3). La diferencia es menor al 20%, así que el sistema resalta A por costar menos semanas. Presentas ambas y explicas que la ley le permite elegir A.",
  "esperado": {
   "resultado": "APTO",
   "montoA": 19500,
   "semanasA": 88.8,
   "montoB": 20700,
   "semanasB": 94.3,
   "modalidadMenosSemanas": "A"
  },
  "version": 1
 },
 {
  "clave": "C-R04",
  "ruta": "R1",
  "tipo": "retiro",
  "titulo": "Quiere retirar, pero ya trabaja",
  "narrativa": "Joven de 24 años, Ley 97, 115 semanas. Su constancia muestra un alta vigente desde hace 5 días con una nueva empresa. Cuenta de 5 años, 14 bimestres, SBC $300, saldo RCV $30,000.",
  "hoy": "2026-11-12",
  "datos": {
   "sbcUltimo": 300,
   "sbcPromedio250": null,
   "saldoRcv": 30000,
   "bimestres": 14,
   "antiguedadAnios": 5,
   "semanasTotales": 115,
   "regimen": "L97",
   "fechaNacimiento": "2002-06-01",
   "fechaBaja": null,
   "cotizaActualmente": true,
   "fechaAperturaCuenta": "2021-03-01",
   "estadoUltimoRetiro": "nunca_retiro",
   "fechaUltimoRetiro": null,
   "ideVigente": true,
   "tipoCuenta": "registrada",
   "saldoVoluntarias": 0
  },
  "captura": [
   "resultado"
  ],
  "explicacion": "NO_TODAVIA: cotiza actualmente. Si deja el empleo, podrá pedirlo 46 días después de su baja.",
  "esperado": {
   "resultado": "NO_TODAVIA"
  },
  "version": 1
 },
 {
  "clave": "C-R08",
  "ruta": "R1",
  "tipo": "retiro",
  "titulo": "Trabaja en el gobierno",
  "narrativa": "Cliente de 45 años. Su constancia del IMSS muestra baja en 2011 y 316 semanas, pero desde 2010 trabaja en una dependencia y le descuentan del ISSSTE. Cuenta Afore de 23 años, 70 bimestres, SBC $250, saldo RCV $60,000.",
  "hoy": "2026-11-12",
  "datos": {
   "sbcUltimo": 250,
   "sbcPromedio250": null,
   "saldoRcv": 60000,
   "bimestres": 70,
   "antiguedadAnios": 23,
   "semanasTotales": 316,
   "regimen": "L97",
   "fechaNacimiento": "1981-01-01",
   "fechaBaja": "2011-06-30",
   "cotizaActualmente": true,
   "fechaAperturaCuenta": "2003-01-01",
   "estadoUltimoRetiro": "nunca_retiro",
   "fechaUltimoRetiro": null,
   "ideVigente": true,
   "tipoCuenta": "registrada",
   "saldoVoluntarias": 0
  },
  "captura": [
   "resultado"
  ],
  "explicacion": "No hay retiro por desempleo: tiene relación laboral vigente (ISSSTE), así que se trata como «cotiza actualmente» → NO_TODAVIA. Detéctalo como posible caso de portabilidad (ruta P1).",
  "esperado": {
   "resultado": "NO_TODAVIA"
  },
  "version": 1
 },
 {
  "clave": "C-R09",
  "ruta": "R1",
  "tipo": "retiro",
  "titulo": "Ya retiró hace menos de 5 años",
  "narrativa": "Mismo perfil que C-R01 (Ley 97, cuenta de 4 años, 20 bimestres, SBC $500, saldo $100,000, 400 semanas, baja hace 60 días), pero su estado de cuenta muestra un retiro por desempleo el 15 de marzo de 2022.",
  "hoy": "2026-11-12",
  "datos": {
   "sbcUltimo": 500,
   "sbcPromedio250": null,
   "saldoRcv": 100000,
   "bimestres": 20,
   "antiguedadAnios": 4,
   "semanasTotales": 400,
   "regimen": "L97",
   "fechaNacimiento": "1990-05-10",
   "fechaBaja": "2026-09-13",
   "cotizaActualmente": false,
   "fechaAperturaCuenta": "2022-10-01",
   "estadoUltimoRetiro": "con_retiro",
   "fechaUltimoRetiro": "2022-03-15",
   "ideVigente": true,
   "tipoCuenta": "registrada",
   "saldoVoluntarias": 0
  },
  "captura": [
   "resultado",
   "fechaElegibilidad"
  ],
  "explicacion": "NO_TODAVIA: el candado de 5 años termina el 15 de marzo de 2027. Le das la fecha y queda en espera con alerta.",
  "esperado": {
   "resultado": "NO_TODAVIA",
   "fechaElegibilidad": "2027-03-15"
  },
  "version": 1
 },
 {
  "clave": "C-R05",
  "ruta": "R2",
  "tipo": "retiro",
  "titulo": "Ley 97 cerca de pensionarse",
  "narrativa": "Cliente Ley 97 de 58 años (cumple 60 en 2028, cuando el mínimo será 925 semanas). Tiene 950 semanas, saldo RCV $285,000, último SBC $400, cuenta de 10 años con 60 bimestres, baja hace 72 días. Nunca ha retirado; IDE vigente y cuenta registrada.",
  "hoy": "2026-11-12",
  "datos": {
   "sbcUltimo": 400,
   "sbcPromedio250": null,
   "saldoRcv": 285000,
   "bimestres": 60,
   "antiguedadAnios": 10,
   "semanasTotales": 950,
   "regimen": "L97",
   "fechaNacimiento": "1968-03-01",
   "fechaBaja": "2026-09-01",
   "cotizaActualmente": false,
   "fechaAperturaCuenta": "2016-01-01",
   "estadoUltimoRetiro": "nunca_retiro",
   "fechaUltimoRetiro": null,
   "ideVigente": true,
   "tipoCuenta": "registrada",
   "saldoVoluntarias": 0
  },
  "captura": [
   "resultado",
   "semanasA"
  ],
  "explicacion": "CALIFICA_NO_CONVIENE: retiraría $12,000 y perdería 40 semanas; quedaría con 910, debajo de las 925 que necesita en 2028. Guion «no te conviene» y oferta de asesoría de pensión.",
  "esperado": {
   "resultado": "CALIFICA_NO_CONVIENE",
   "semanasA": 40
  },
  "version": 1
 },
 {
  "clave": "C-R06",
  "ruta": "R2",
  "tipo": "retiro",
  "titulo": "Ley 73 con muchas semanas",
  "narrativa": "Cliente Ley 73 de 56 años con 900 semanas, saldo RCV $300,000, último SBC $333.34, cuenta de 15 años con 90 bimestres, baja hace 72 días. Nunca ha retirado; IDE vigente y cuenta registrada.",
  "hoy": "2026-11-12",
  "datos": {
   "sbcUltimo": 333.34,
   "sbcPromedio250": null,
   "saldoRcv": 300000,
   "bimestres": 90,
   "antiguedadAnios": 15,
   "semanasTotales": 900,
   "regimen": "L73",
   "fechaNacimiento": "1970-04-01",
   "fechaBaja": "2026-09-01",
   "cotizaActualmente": false,
   "fechaAperturaCuenta": "2011-01-01",
   "estadoUltimoRetiro": "nunca_retiro",
   "fechaUltimoRetiro": null,
   "ideVigente": true,
   "tipoCuenta": "registrada",
   "saldoVoluntarias": 0
  },
  "captura": [
   "resultado",
   "semanasA",
   "incrementosAntes",
   "incrementosDespues"
  ],
  "explicacion": "Califica (APTO), pero pierde 30 semanas: de 900 a 870, y sus incrementos del art. 167 bajan de 8 a 7, de por vida. Requiere análisis de impacto antes del contrato; el asesor R2 captura el borrador y lo explica.",
  "esperado": {
   "resultado": "APTO",
   "semanasA": 30,
   "incrementosAntes": 8,
   "incrementosDespues": 7
  },
  "version": 1
 },
 {
  "clave": "C-R07",
  "ruta": "R2",
  "tipo": "retiro",
  "titulo": "Semanas descontadas sin estado de cuenta",
  "narrativa": "Todo cumple como en C-R01, pero la constancia muestra semanas descontadas por un retiro anterior y el cliente todavía no trae su estado de cuenta de la Afore.",
  "hoy": "2026-11-12",
  "datos": {
   "sbcUltimo": 500,
   "sbcPromedio250": null,
   "saldoRcv": 100000,
   "bimestres": 20,
   "antiguedadAnios": 4,
   "semanasTotales": 400,
   "regimen": "L97",
   "fechaNacimiento": "1990-05-10",
   "fechaBaja": "2026-09-13",
   "cotizaActualmente": false,
   "fechaAperturaCuenta": "2022-10-01",
   "estadoUltimoRetiro": "por_verificar",
   "fechaUltimoRetiro": null,
   "ideVigente": true,
   "tipoCuenta": "registrada",
   "saldoVoluntarias": 0
  },
  "captura": [
   "resultado"
  ],
  "explicacion": "APTO_BLOQUEADO: la constancia no dice la fecha del retiro. Tarea: verificar el último retiro en el estado de cuenta de la Afore.",
  "esperado": {
   "resultado": "APTO_BLOQUEADO"
  },
  "version": 1
 },
 {
  "clave": "C-P01",
  "ruta": "P1",
  "tipo": "opcion",
  "titulo": "Ley 73 en el piso",
  "narrativa": "Cliente Ley 73 de 59 años con 654 semanas y salario promedio bajo: su cuantía calculada es de unos $3,249 al mes, debajo del piso.",
  "opciones": [
   "Esperar a los 65 para cobrar el 100%.",
   "Planear la pensión a los 60 (cumpliendo «sin trabajo remunerado»): en el piso cobra lo mismo que a los 65; las asignaciones no suman. Preguntar ya su estado civil.",
   "Hacer Modalidad 40 para subir la pensión al doble."
  ],
  "correcta": 1,
  "explicacion": "Debajo del piso, a los 60 cobra lo mismo que a los 65 → conviene planear a los 60. Las asignaciones familiares quedan dentro del piso. La viudez se calcula sobre el piso: el estado civil es pregunta urgente.",
  "version": 1
 },
 {
  "clave": "C-P02",
  "ruta": "P1",
  "tipo": "opcion",
  "titulo": "Sin cotizar desde hace 14 años",
  "narrativa": "Cliente Ley 73 de 56 años, 1,093 semanas, sin cotizar desde hace casi 14 años; hoy trabaja como independiente.",
  "opciones": [
   "Puede pensionarse a los 60 sin hacer nada.",
   "Su conservación de derechos (¼ del tiempo cotizado ≈ 5 años) ya venció: debe volver a cotizar para recuperarla; M40 ya cerró (más de 5 años de la baja) → evaluar M10/PTI; revisar qué firmó al «traspasar» su crédito Infonavit; pasarlo al Director.",
   "Le ofreces Modalidad 40 de inmediato."
  ],
  "correcta": 1,
  "explicacion": "Conservación vencida → recuperar derechos cotizando (52 semanas tras más de 6 años fuera). M40 exige pedirla dentro de 5 años de la baja: ya no. M10/PTI es la vía. Caso para el Director.",
  "version": 1
 },
 {
  "clave": "C-P03",
  "ruta": "P1",
  "tipo": "opcion",
  "titulo": "Recién desempleado, 61 años",
  "narrativa": "Cliente Ley 73 de 61 años, lo dieron de baja hace 3 meses y tiene más de 52 semanas en los últimos 5 años.",
  "opciones": [
   "Candidato a Modalidad 40 (está dentro de 5 años de la baja). Advertir por escrito: no da servicio médico y causa baja con 2 meses sin pagar. Si necesita médico, M10 dentro de la ventana de 12 meses.",
   "Le dices que M40 incluye servicio médico.",
   "Le recomiendas retirar su Afore primero."
  ],
  "correcta": 0,
  "explicacion": "M40: dentro de 5 años de la baja y 52 semanas en los últimos 5 años. Sin servicio médico y baja con 2 meses sin pago (va firmado). Para atención médica, M10 en los 12 meses.",
  "version": 1
 },
 {
  "clave": "C-P04",
  "ruta": "P1",
  "tipo": "opcion",
  "titulo": "Viudez que probablemente no procede",
  "narrativa": "Murió un asegurado Ley 73 con 834 semanas; dejó de cotizar a los 48 años y murió a los 73 sin pensionarse. El acta de defunción dice «soltero» pero tenía esposa.",
  "opciones": [
   "La viudez procede seguro: tenía más de 150 semanas.",
   "La viudez probablemente no procede (su conservación de derechos venció antes de los 60) y lo confirma el abogado; sí se recupera Afore (quizá ya en el Fondo Bienestar por haber cumplido 70) y vivienda; hay que corregir el estado civil del acta.",
   "No hay nada que recuperar."
  ],
  "correcta": 1,
  "explicacion": "Además de las 150 semanas, al morir debía seguir cotizando o estar dentro de su conservación de derechos. Sí se recuperan Afore y vivienda (no prescriben). El acta se corrige; si hace falta, juicio de designación de beneficiarios.",
  "version": 1
 },
 {
  "clave": "C-P05",
  "ruta": "P1",
  "tipo": "opcion",
  "titulo": "Unión libre y enfermo grave",
  "narrativa": "Pareja en unión libre desde hace 12 años, sin hijos. Él es pensionado Ley 73, tiene 66 años y está enfermo grave.",
  "opciones": [
   "Que se casen hoy y listo.",
   "Urge la declaración judicial de concubinato estando él vivo (casarse hoy abre el plazo de 1 año del art. 154); designar beneficiarios en la Afore; canalizar al abogado.",
   "No hace falta nada: el IMSS acepta una carta del ayudante municipal."
  ],
  "correcta": 1,
  "explicacion": "Casado ya pensionado: la viudez exige 1 año de matrimonio (sin hijos). La sentencia de concubinato con él vivo es más rápida y barata. El IMSS no acepta cartas ni actas notariales.",
  "version": 1
 },
 {
  "clave": "C-P06",
  "ruta": "P1",
  "tipo": "opcion",
  "titulo": "Pensionado sin crédito Infonavit",
  "narrativa": "Pensionado de 68 años que nunca usó su crédito Infonavit.",
  "opciones": [
   "Ya no tiene derecho a nada.",
   "Devolución de vivienda: pedir las tres bolsas (Fondo 72-92, Vivienda 92 y 97), revisar que NSS, CURP y RFC coincidan, estado de cuenta bancario de menos de 2 meses; está exenta de ISR; mejor antes de los 70.",
   "Le cobras un porcentaje de lo que reciba de pensión."
  ],
  "correcta": 1,
  "explicacion": "Imprescriptible y exenta. El 90% de los rechazos son por datos que no coinciden o estado de cuenta bancario viejo. A los 70 pasa al Fondo Bienestar, pero no se pierde.",
  "version": 1
 },
 {
  "clave": "C-P07",
  "ruta": "P2",
  "tipo": "opcion",
  "titulo": "Préstamos que se comen la pensión",
  "narrativa": "Un pensionado recibe $900 de una pensión de $6,000 porque le descuentan tres préstamos.",
  "opciones": [
   "Es normal, firmó los préstamos.",
   "Los descuentos pasan del 30% y lo dejan debajo del piso legal: es caso de reclamación al IMSS y queja en CONDUSEF (lo arma el Director).",
   "Le recomiendas otro préstamo para pagar los anteriores."
  ],
  "correcta": 1,
  "explicacion": "El total de descuentos no puede pasar del 30%, ni dejarla debajo del promedio de las garantizadas, ni plazo mayor a 60 meses (Transitorio Vigésimo Noveno LSS).",
  "version": 1
 }
];

export const RUBRICA: Rubrica = {
 "version": 1,
 "minimo": 80,
 "criterios": [
  {
   "clave": "fecha_baja_trabaja",
   "criterio": "Preguntó la fecha de baja y si trabaja hoy (incluido gobierno) antes que nada",
   "peso": 15,
   "eliminatorio": true
  },
  {
   "clave": "regimen",
   "criterio": "Identificó el régimen (Ley 73 / Ley 97)",
   "peso": 10,
   "eliminatorio": true
  },
  {
   "clave": "monto_y_semanas",
   "criterio": "Presentó monto y semanas juntos, como estimado",
   "peso": 20,
   "eliminatorio": true
  },
  {
   "clave": "sin_promesas",
   "criterio": "No prometió montos ni plazos fuera de los permitidos",
   "peso": 15,
   "eliminatorio": true
  },
  {
   "clave": "honorario",
   "criterio": "Explicó el honorario con claridad (30% IVA incluido)",
   "peso": 10,
   "eliminatorio": false
  },
  {
   "clave": "objecion",
   "criterio": "Manejó la objeción planteada con la respuesta honesta",
   "peso": 15,
   "eliminatorio": false
  },
  {
   "clave": "siguiente_paso",
   "criterio": "Siguiente paso claro (documentos, fecha, cita con el Director)",
   "peso": 10,
   "eliminatorio": false
  },
  {
   "clave": "tono",
   "criterio": "Tono: claro, tuteo, sin tecnicismos frente al cliente",
   "peso": 5,
   "eliminatorio": false
  }
 ]
};

export const ROLEPLAYS: Roleplay[] = [
 {
  "clave": "RP-01",
  "ruta": "R1",
  "escenario": "Cliente Ley 97 apto que objeta el 30%",
  "perfil": "Ley 97, baja hace 2 meses, todo en regla",
  "objecion": "«¿Por qué 30%? Es mucho.»"
 },
 {
  "clave": "RP-02",
  "ruta": "R1",
  "escenario": "Cliente que quiere retirar pero cotiza actualmente",
  "perfil": "Trabaja desde hace una semana en otra empresa",
  "objecion": "«Me dijeron que sí se puede.»"
 },
 {
  "clave": "RP-03",
  "ruta": "R2",
  "escenario": "Cliente Ley 73 con 950 semanas y 59 años que «necesita el dinero ya»",
  "perfil": "Ley 73, 950 semanas, 59 años",
  "objecion": "«Necesito el dinero ya.» Debe terminar en «no te conviene» + cita con el Director"
 },
 {
  "clave": "RP-04",
  "ruta": "P1",
  "escenario": "Viuda en unión libre cuya pareja murió hace 8 meses",
  "perfil": "Unión libre, pareja Ley 73 fallecida hace 8 meses",
  "objecion": "«Me dijeron que la Corte ya quitó los 5 años.»"
 },
 {
  "clave": "RP-05",
  "ruta": "P1",
  "escenario": "Recién desempleado Ley 73 de 61 años interesado en M40 que cree que tendrá servicio médico",
  "perfil": "Ley 73, 61 años, baja hace 2 meses",
  "objecion": "«Con la 40 tengo IMSS, ¿verdad?»"
 }
];

export const MICROLECCIONES: Microleccion[] = [
 {
  "clave": "UMA",
  "parametros": [
   "UMA_MENSUAL",
   "UMA_DIARIA"
  ],
  "modulos": [
   "R1-02"
  ],
  "titulo": "Nueva UMA desde el {{desde}}",
  "contenido": "## La UMA cambió\n\nDesde el **{{desde}}** la UMA mensual es **{{P:UMA_MENSUAL|pesos}}** (antes {{A:UMA_MENSUAL|pesos}}) y la diaria **{{P:UMA_DIARIA|pesos}}**.\n\n### Qué cambia para ti\n\n- El tope de la modalidad A del retiro es de **{{P:MODALIDAD_A_TOPE_UMAS|entero}} UMA mensuales**: ahora **{{P:UMA_MENSUAL*P:MODALIDAD_A_TOPE_UMAS|pesos}}** (antes {{A:UMA_MENSUAL*A:MODALIDAD_A_TOPE_UMAS|pesos}}).\n- La modalidad A sigue siendo lo menor entre 30 días del último salario base de cotización, ese tope y el saldo de la subcuenta de retiro, cesantía y vejez.\n- Si el cliente gana poco, sus 30 días de salario quedan debajo del tope y su monto no cambia.\n- El sistema toma la UMA de los parámetros vigentes en la fecha del cálculo. Nunca la captures a mano ni uses la de una tabla vieja.\n\n> **Lo que dices:** «Es un estimado con los valores vigentes; el monto final lo determina la Afore.»",
  "preguntas": [
   {
    "clave": "Q1",
    "tipo": "numerica",
    "enunciado": "¿Cuánto es la UMA mensual vigente desde el {{desde}}?",
    "opciones": [],
    "correcta": "{{P:UMA_MENSUAL}}",
    "tolerancia": 0.01
   },
   {
    "clave": "Q2",
    "tipo": "numerica",
    "enunciado": "Califica solo a la modalidad A. Último salario base de cotización: $3,000 diarios; saldo de retiro, cesantía y vejez: $500,000. ¿Cuál es el monto estimado con la UMA nueva?",
    "opciones": [],
    "correcta": "{{P:UMA_MENSUAL*P:MODALIDAD_A_TOPE_UMAS}}",
    "tolerancia": 1,
    "explicacion": "30 × $3,000 = $90,000 pasa del tope: se paga el tope de {{P:MODALIDAD_A_TOPE_UMAS|entero}} UMA mensuales = {{P:UMA_MENSUAL*P:MODALIDAD_A_TOPE_UMAS|pesos}}."
   },
   {
    "clave": "Q3",
    "tipo": "opcion_multiple",
    "enunciado": "Modalidad A, último salario base de cotización de $300 diarios y saldo de $200,000. ¿Le cambia el monto estimado con la UMA nueva?",
    "opciones": [
     "No: 30 × $300 = $9,000 queda debajo del tope.",
     "Sí: siempre se paga el tope de {{P:MODALIDAD_A_TOPE_UMAS|entero}} UMA mensuales.",
     "Sí: sube en la misma proporción que la UMA."
    ],
    "correcta": 0
   },
   {
    "clave": "Q4",
    "tipo": "opcion_multiple",
    "enunciado": "¿De dónde sale la UMA que usa el sistema en la precalificación?",
    "opciones": [
     "De los parámetros vigentes en la fecha del cálculo.",
     "La capturas tú en cada caso.",
     "De la tabla impresa del año anterior."
    ],
    "correcta": 0
   },
   {
    "clave": "Q5",
    "tipo": "opcion_multiple",
    "enunciado": "El tope de la modalidad A desde el {{desde}} es:",
    "opciones": [
     "{{P:UMA_MENSUAL*P:MODALIDAD_A_TOPE_UMAS|pesos}}",
     "{{A:UMA_MENSUAL*A:MODALIDAD_A_TOPE_UMAS|pesos}}",
     "{{P:UMA_DIARIA*P:MODALIDAD_A_TOPE_UMAS|pesos}}"
    ],
    "correcta": 0
   }
  ]
 },
 {
  "clave": "HONORARIO",
  "parametros": [
   "HONORARIO_RETIRO_PCT"
  ],
  "modulos": [
   "N0-01",
   "R1-07"
  ],
  "titulo": "Nuevo honorario del retiro desde el {{desde}}",
  "contenido": "## El honorario del retiro cambió\n\nDesde el **{{desde}}** el honorario es **{{P:HONORARIO_RETIRO_PCT|pct}} de lo que paga la Afore, IVA incluido** (antes {{A:HONORARIO_RETIRO_PCT|pct}}).\n\n### Cómo lo explicas\n\n- Es un porcentaje de lo que la Afore deposita al cliente; se cobra cuando la Afore paga.\n- Ya incluye el IVA: no se suma nada aparte.\n- Ejemplo: si la Afore deposita $10,000, el honorario es {{P:HONORARIO_RETIRO_PCT*10000|pesos}}.\n- Genera el contrato desde el sistema: ya trae el porcentaje vigente.\n\n> **Lo que dices:** «Nuestro honorario es el {{P:HONORARIO_RETIRO_PCT|pct}} de lo que te pague la Afore, con IVA incluido. Si no te pagan, no nos pagas.»",
  "preguntas": [
   {
    "clave": "Q1",
    "tipo": "numerica",
    "enunciado": "La Afore deposita $10,000 al cliente. ¿Cuál es el honorario con el porcentaje vigente (IVA incluido)?",
    "opciones": [],
    "correcta": "{{P:HONORARIO_RETIRO_PCT*10000}}",
    "tolerancia": 0.5
   },
   {
    "clave": "Q2",
    "tipo": "opcion_multiple",
    "enunciado": "El honorario del retiro vigente desde el {{desde}} es:",
    "opciones": [
     "{{P:HONORARIO_RETIRO_PCT|pct}} de lo que paga la Afore, IVA incluido.",
     "{{A:HONORARIO_RETIRO_PCT|pct}} de lo que paga la Afore, IVA incluido.",
     "{{P:HONORARIO_RETIRO_PCT|pct}} más IVA."
    ],
    "correcta": 0
   },
   {
    "clave": "Q3",
    "tipo": "opcion_multiple",
    "enunciado": "Un cliente pregunta si al honorario se le suma el IVA. ¿Qué le contestas?",
    "opciones": [
     "No: el {{P:HONORARIO_RETIRO_PCT|pct}} ya incluye el IVA.",
     "Sí: se suma el 16% de IVA.",
     "Depende del monto que pague la Afore."
    ],
    "correcta": 0
   },
   {
    "clave": "Q4",
    "tipo": "numerica",
    "enunciado": "El monto estimado de la Afore es $20,000. ¿Qué honorario estimado le explicas al cliente?",
    "opciones": [],
    "correcta": "{{P:HONORARIO_RETIRO_PCT*20000}}",
    "tolerancia": 0.5
   },
   {
    "clave": "Q5",
    "tipo": "opcion_multiple",
    "enunciado": "¿Cuándo se cobra el honorario del retiro?",
    "opciones": [
     "Cuando la Afore paga al cliente.",
     "Al firmar el contrato.",
     "Al ingresar la solicitud a la Afore."
    ],
    "correcta": 0
   }
  ]
 },
 {
  "clave": "COSTO_ALTA",
  "parametros": [
   "COSTO_ADMIN_ALTA"
  ],
  "modulos": [
   "N0-01"
  ],
  "titulo": "Nuevo costo administrativo por alta desde el {{desde}}",
  "contenido": "## Cambió el costo administrativo por alta\n\nDesde el **{{desde}}** el costo administrativo por alta es **{{P:COSTO_ADMIN_ALTA|pesos}}** (antes {{A:COSTO_ADMIN_ALTA|pesos}}).\n\n### Cómo afecta tu comisión\n\nTu comisión = (honorario − costo administrativo del alta) × tu porcentaje.\n\nEjemplo con honorario de $3,000 y tu porcentaje de 40%: ($3,000 − {{P:COSTO_ADMIN_ALTA|pesos}}) × 40% = **{{(3000-P:COSTO_ADMIN_ALTA)*0.4|pesos}}**.\n\nTu porcentaje lo marca tu esquema de comisión; consúltalo en tu estado de cuenta.",
  "preguntas": [
   {
    "clave": "Q1",
    "tipo": "opcion_multiple",
    "enunciado": "El costo administrativo por alta vigente desde el {{desde}} es:",
    "opciones": [
     "{{P:COSTO_ADMIN_ALTA|pesos}}",
     "{{A:COSTO_ADMIN_ALTA|pesos}}",
     "No hay costo administrativo."
    ],
    "correcta": 0
   },
   {
    "clave": "Q2",
    "tipo": "numerica",
    "enunciado": "Honorario cobrado: $3,000; tu porcentaje: 40%. Con el costo administrativo vigente, ¿cuál es tu comisión?",
    "opciones": [],
    "correcta": "{{(3000-P:COSTO_ADMIN_ALTA)*0.4}}",
    "tolerancia": 0.5
   },
   {
    "clave": "Q3",
    "tipo": "numerica",
    "enunciado": "Honorario cobrado: $6,000; tu porcentaje: 40%. ¿Cuál es tu comisión?",
    "opciones": [],
    "correcta": "{{(6000-P:COSTO_ADMIN_ALTA)*0.4}}",
    "tolerancia": 0.5
   },
   {
    "clave": "Q4",
    "tipo": "numerica",
    "enunciado": "Con un honorario de $3,000 y tu porcentaje de 40%, ¿cuánto cambia tu comisión respecto del costo anterior? (positivo si sube, negativo si baja)",
    "opciones": [],
    "correcta": "{{(A:COSTO_ADMIN_ALTA-P:COSTO_ADMIN_ALTA)*0.4}}",
    "tolerancia": 0.5
   },
   {
    "clave": "Q5",
    "tipo": "opcion_multiple",
    "enunciado": "¿Cómo se calcula tu comisión de un retiro?",
    "opciones": [
     "(Honorario − costo administrativo del alta) × tu porcentaje.",
     "Honorario × tu porcentaje, sin descuentos.",
     "Lo que paga la Afore × tu porcentaje."
    ],
    "correcta": 0
   }
  ]
 },
 {
  "clave": "DIAS_ESPERA",
  "parametros": [
   "DIAS_ESPERA_DESEMPLEO"
  ],
  "modulos": [
   "R1-01"
  ],
  "titulo": "Cambió el plazo para solicitar el retiro desde el {{desde}}",
  "contenido": "## Nuevo criterio de días de espera\n\nDesde el **{{desde}}** la fecha elegible es la **fecha de baja + {{P:DIAS_ESPERA_DESEMPLEO|entero}} días naturales** (antes {{A:DIAS_ESPERA_DESEMPLEO|entero}}).\n\nEjemplo: baja el 1 de octubre de 2026 → se puede solicitar desde el **{{fecha:2026-10-01+P:DIAS_ESPERA_DESEMPLEO}}**.\n\nEl sistema calcula la fecha elegible con el parámetro vigente: revisa la fecha en el expediente antes de dar una fecha al cliente.",
  "preguntas": [
   {
    "clave": "Q1",
    "tipo": "numerica",
    "enunciado": "¿Cuántos días naturales después de la baja se puede solicitar el retiro con el criterio vigente desde el {{desde}}?",
    "opciones": [],
    "correcta": "{{P:DIAS_ESPERA_DESEMPLEO}}",
    "tolerancia": 0
   },
   {
    "clave": "Q2",
    "tipo": "opcion_multiple",
    "enunciado": "Fecha de baja: 1 de octubre de 2026. ¿Desde qué fecha se puede solicitar el retiro?",
    "opciones": [
     "{{fecha:2026-10-01+P:DIAS_ESPERA_DESEMPLEO}}",
     "{{fecha:2026-10-01+A:DIAS_ESPERA_DESEMPLEO}}",
     "1 de octubre de 2026"
    ],
    "correcta": 0
   },
   {
    "clave": "Q3",
    "tipo": "opcion_multiple",
    "enunciado": "Fecha de baja: 15 de marzo de 2027. ¿Desde qué fecha se puede solicitar el retiro?",
    "opciones": [
     "{{fecha:2027-03-15+A:DIAS_ESPERA_DESEMPLEO}}",
     "{{fecha:2027-03-15+P:DIAS_ESPERA_DESEMPLEO}}",
     "15 de abril de 2027"
    ],
    "correcta": 1
   },
   {
    "clave": "Q4",
    "tipo": "opcion_multiple",
    "enunciado": "Los días de espera se cuentan en:",
    "opciones": [
     "Días naturales desde la fecha de baja.",
     "Días hábiles desde la fecha de baja.",
     "Días hábiles desde que el cliente firma."
    ],
    "correcta": 0
   },
   {
    "clave": "Q5",
    "tipo": "opcion_multiple",
    "enunciado": "Antes de darle una fecha al cliente, tú:",
    "opciones": [
     "Revisas la fecha elegible que calcula el sistema en el expediente.",
     "Le sumas 30 días a la baja de memoria.",
     "Le dices que en cuanto firme se ingresa."
    ],
    "correcta": 0
   }
  ]
 },
 {
  "clave": "PLAZOS",
  "parametros": [
   "SLA_DIAS_HABILES",
   "AFORE_DIAS_HABILES"
  ],
  "modulos": [
   "R1-06"
  ],
  "titulo": "Cambiaron los plazos de ingreso y resolución desde el {{desde}}",
  "contenido": "## Nuevos plazos\n\nDesde el **{{desde}}**:\n\n- Ingresamos la solicitud en máximo **{{P:SLA_DIAS_HABILES|entero}} días hábiles** desde que el expediente está completo (antes {{A:SLA_DIAS_HABILES|entero}}).\n- La Afore tiene **{{P:AFORE_DIAS_HABILES|entero}} días hábiles** para resolver (antes {{A:AFORE_DIAS_HABILES|entero}}).\n\nSon días hábiles: el sistema descuenta fines de semana y los días inhábiles cargados.\n\n> **Lo que dices:** «Ingresamos en máximo {{P:SLA_DIAS_HABILES|entero}} días hábiles desde que tu expediente está completo; la Afore tiene {{P:AFORE_DIAS_HABILES|entero}} días hábiles para resolver.»\n>\n> **Lo que nunca dices:** «En 30 días ya tienes tu dinero.»",
  "preguntas": [
   {
    "clave": "Q1",
    "tipo": "numerica",
    "enunciado": "¿En cuántos días hábiles como máximo ingresamos la solicitud desde que el expediente está completo?",
    "opciones": [],
    "correcta": "{{P:SLA_DIAS_HABILES}}",
    "tolerancia": 0
   },
   {
    "clave": "Q2",
    "tipo": "numerica",
    "enunciado": "¿Cuántos días hábiles tiene la Afore para resolver?",
    "opciones": [],
    "correcta": "{{P:AFORE_DIAS_HABILES}}",
    "tolerancia": 0
   },
   {
    "clave": "Q3",
    "tipo": "opcion_multiple",
    "enunciado": "¿Qué plazo le explicas al cliente?",
    "opciones": [
     "\"En 30 días ya tienes tu dinero.\"",
     "Ingresamos en máximo {{P:SLA_DIAS_HABILES|entero}} días hábiles desde que el expediente está completo; la Afore tiene {{P:AFORE_DIAS_HABILES|entero}} días hábiles para resolver.",
     "\"Mañana mismo.\""
    ],
    "correcta": 1
   },
   {
    "clave": "Q4",
    "tipo": "opcion_multiple",
    "enunciado": "Estos plazos se cuentan en:",
    "opciones": [
     "Días hábiles, sin fines de semana ni días inhábiles.",
     "Días naturales.",
     "Semanas completas."
    ],
    "correcta": 0
   },
   {
    "clave": "Q5",
    "tipo": "opcion_multiple",
    "enunciado": "¿Desde cuándo corre nuestro plazo de ingreso?",
    "opciones": [
     "Desde que el expediente está completo.",
     "Desde que el cliente llama por primera vez.",
     "Desde la fecha de baja."
    ],
    "correcta": 0
   }
  ]
 }
];
