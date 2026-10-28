# Propuesta: WhatsApp Business API para RPD Control (fase 4, 13.6)

Estado: **propuesta, sin implementar.** Se implementa cuando Irving la apruebe.

## 1. Qué resolvería

| Hoy (botones `wa.me`) | Con la API |
| --- | --- |
| El asesor abre WhatsApp con el texto prellenado y lo envía a mano. | El CRM envía solo los avisos de rutina (día 46, documentos pendientes, recordatorio M40, solicitud ingresada, Afore aprobó). |
| Las alertas críticas solo llegan a la campana y al correo de las 07:15. | Las críticas (8.2: «WhatsApp al equipo, solo críticas») llegan al WhatsApp del asesor y del Director. |
| Lo que el cliente responde no queda en el expediente. | Las respuestas del cliente entran a «Seguimiento» del caso. |

## 2. Cuánto cuesta

Meta cobra **por mensaje entregado**, según el país del destinatario (México) y la categoría de la plantilla.
Tarifas reportadas para México con la tabla vigente desde el 1-oct-2026 (en dólares; **hay que confirmarlas en la
calculadora oficial de Meta antes de contratar**, las fuentes no coinciden en marketing):

| Categoría | Para qué la usaríamos | US$ por mensaje |
| --- | --- | --- |
| Utilidad | Avisos del trámite al cliente y alertas al equipo | ~0.0085 |
| Marketing | Solicitud de referidos, promociones | 0.030 – 0.046 |
| Servicio (respuestas a lo que escribe el cliente) | Conversación normal | Primeros 1,000 al mes por número sin costo; después ~0.0085 |

Estimación mensual con **60 casos activos** (ajustable):

| Concepto | Mensajes/mes | US$/mes |
| --- | --- | --- |
| Avisos al cliente (≈ 8 por caso) | 480 | ~4.10 |
| Alertas críticas al equipo (5 personas × 2 al día) | 300 | ~2.60 |
| Referidos / marketing | 100 | 3.00 – 4.60 |
| Respuestas de servicio | < 1,000 | 0 |
| **Total Meta** | | **≈ 10 – 12 dólares al mes** (≈ 200 – 250 pesos) |

Si se contrata un intermediario (BSP) como Twilio, se suma su comisión por mensaje (del orden de US$0.005) o una
mensualidad. **Recomiendo conectar directo a la Cloud API de Meta**: sin intermediario, sin mensualidad, y el CRM ya
corre en un servidor que puede llamar a la API.

## 3. Cómo se conectaría

```text
RPD Control (Vercel) ──plantilla aprobada──▶ WhatsApp Cloud API (Meta) ──▶ cliente / equipo
        ▲                                                │
        └──────── webhook firmado (respuestas, estado de entrega) ◀──┘
```

- **Envío:** la tarea diaria y los cambios de etapa ponen mensajes en una cola (`mensajes_whatsapp`) y un proceso los
  envía con la plantilla aprobada; cada envío queda en el expediente con su estado (enviado, entregado, leído, error).
- **Recepción:** `/api/whatsapp/webhook` valida la firma de Meta (`X-Hub-Signature-256`) y guarda la respuesta como
  evento del caso (se identifica por el teléfono del cliente).
- **Plantillas:** las 9 de la sección 8.3 se registran en Meta como «utilidad» (referidos como «marketing»). Meta las
  revisa en minutos u horas.
- **Consentimiento:** solo se escribe a clientes que aceptaron recibir mensajes por WhatsApp. Propongo agregar esa
  casilla al alta y al formulario del sitio, y registrar la fecha (el aviso de privacidad ya menciona WhatsApp).
- **Datos sensibles:** igual que el correo diario, los mensajes llevan nombre y folio, nunca NSS, CURP ni montos.
- **Secretos:** `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID` y `WHATSAPP_APP_SECRET` en Vercel; nunca en el código.

## 4. Lo que tendría que hacer Irving

1. Crear o verificar la cuenta de **Meta Business** (razón social / RFC de Irving) — la verificación puede tardar días.
2. Decidir el **número**: usar el actual 56 6474 9567 con la «coexistencia» (app de WhatsApp Business y API en el mismo
   número, si Meta la ofrece para la cuenta) o un número nuevo solo para el CRM. Recomiendo probar la coexistencia;
   si no está disponible, un número nuevo para avisos automáticos y el actual para conversación.
3. Agregar un método de pago en Meta.
4. Darme acceso de desarrollador a la app de Meta para registrar plantillas y el webhook.

## 5. Plan de implementación (cuando se apruebe)

| Paso | Contenido | Esfuerzo |
| --- | --- | --- |
| 1 | Cola de mensajes, envío con plantilla, registro en el expediente, reintentos | 1 – 2 días |
| 2 | Webhook firmado: estados de entrega y respuestas a «Seguimiento» | 1 día |
| 3 | Alertas críticas al WhatsApp del equipo (opt-in por usuario en su perfil) | 0.5 días |
| 4 | Casilla de consentimiento en alta y sitio; pruebas de RLS y e2e | 0.5 días |

## 6. Riesgos

- **Calidad del número:** si muchos clientes bloquean o reportan, Meta baja el límite de envío. Mitigación: solo
  mensajes esperados por el cliente (utilidad) y con consentimiento.
- **Cambios de tarifa:** Meta cambió precios en julio 2025 y octubre 2026. La tabla de este documento es una referencia.
- **Ventana de 24 horas:** fuera de ella solo se pueden enviar plantillas aprobadas; dentro, texto libre.

Fuentes de tarifas (consultadas el 28-oct-2026; son de proveedores, no de Meta):
[getkanal.com](https://getkanal.com/blog/whatsapp-business-pricing-guide),
[goeva.ai](https://www.goeva.ai/en/resources/whatsapp-business-api-pricing-mexico),
[ManyChat](https://help.manychat.com/hc/en-us/articles/14281380243740-WhatsApp-pricing-guide),
[Mercately](https://blog.mercately.com/nuevos-precios-whatsapp-api-octubre-2026/),
[Aurora Inbox](https://www.aurorainbox.com/2026/05/26/precio-whatsapp-business-api-mexico-2026/).
