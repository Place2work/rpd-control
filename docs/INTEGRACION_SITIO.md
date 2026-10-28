# Formulario del sitio → RPD Control (`POST /api/leads`)

El formulario de precalificación de retiropordesempleo.com manda cada registro al CRM.
El CRM crea el prospecto con origen **web**, en la bandeja general (sin asesor), y le
deja una alerta "prospecto nuevo" al Director.

**La petición se firma en el servidor del sitio, nunca en el navegador.** El secreto no
debe llegar al HTML ni al JavaScript público.

## Petición

`POST https://rpd-control.vercel.app/api/leads` · `Content-Type: application/json`

| Encabezado | Valor |
| --- | --- |
| `X-RPD-Timestamp` | Segundos Unix del momento del envío |
| `X-RPD-Firma` | `sha256=` + HMAC-SHA256 en hexadecimal de `"{timestamp}.{cuerpo}"` con el secreto `LEADS_HMAC_SECRETO` |

La firma vence a los 5 minutos. El cuerpo firmado debe ser exactamente el que se envía.

```json
{
  "nombre": "Lucía",
  "apellido_paterno": "Pérez",
  "apellido_materno": "Gómez",
  "whatsapp": "777 123 4567",
  "email": "lucia@correo.com",
  "servicio": "retiro",
  "fecha_baja": "2026-09-20",
  "mensaje": "Me dieron de baja en septiembre",
  "privacidad_aceptada": true,
  "ip_cliente": "201.141.10.20",
  "utm": { "source": "google", "campaign": "retiro-otono" }
}
```

- Obligatorios: `nombre`, `whatsapp` (10 dígitos o E.164), `servicio` (`retiro` o `pension_l73`)
  y `privacidad_aceptada: true`.
- `ip_cliente` es la IP de quien llenó el formulario; se guarda como evidencia del aviso de privacidad.
- No se reciben CURP ni NSS por el sitio: se piden después, ya con el asesor.

## Respuestas

| Código | Significado |
| --- | --- |
| 201 | Prospecto creado. `{ "ok": true, "folio": "RP-0004", "repetido": false }` |
| 200 | Ya existía con ese WhatsApp y un caso abierto: se anotó en su caso y se avisó. `repetido: true` |
| 401 | Firma ausente, vencida o incorrecta |
| 422 | Datos no válidos; `campos` dice cuáles |
| 413 | Cuerpo mayor a 16 KB |

## Ejemplos

PHP (WordPress, en el servidor):

```php
$cuerpo = wp_json_encode($datos);
$ts = (string) time();
$firma = 'sha256=' . hash_hmac('sha256', $ts . '.' . $cuerpo, getenv('LEADS_HMAC_SECRETO'));
wp_remote_post('https://rpd-control.vercel.app/api/leads', [
  'headers' => ['Content-Type' => 'application/json', 'X-RPD-Timestamp' => $ts, 'X-RPD-Firma' => $firma],
  'body' => $cuerpo, 'timeout' => 10,
]);
```

Node: ver `scripts/probar-leads.cjs`.
