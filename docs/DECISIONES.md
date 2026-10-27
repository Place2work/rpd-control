# Registro de decisiones

| Fecha | Decisión | Quién | Dónde quedó |
| --- | --- | --- | --- |
| 2026-10-27 | Se aprueba la estructura de carpetas y el esquema de datos de la fase 0 | Irving | `prisma/schema.prisma` |
| 2026-10-27 | Búsqueda de CURP/NSS con cifrado + índice ciego (HMAC) y **ligas oficiales de consulta** (RENAPO, IMSS NSS, IMSS semanas), editables como parámetros `LIGA_CONSULTA_*` | Irving | `lib/cripto`, `lib/reglas/identificadores.ts`, `components/rpd/ligas-consulta.tsx` |
| 2026-10-27 | Cuenta con menos de 3 años: el motor da `NO_TODAVIA` con la fecha en que cumple 3 años, y el asesor o el Director pueden **dictaminar manualmente** APTO / NO_APTO con motivo (mín. 10 caracteres). El dictamen prevalece y queda en bitácora | Irving | `casos.dictamen_manual*`, trigger `tg_dictamen_manual` |
| 2026-10-27 | Último retiro con tres estados: `por_verificar`, `nunca_retiro`, `con_retiro` (este exige fecha). Se guarda quién verificó y cuándo | Irving | `datos_afore.estado_ultimo_retiro`, trigger `tg_ultimo_retiro` |
| 2026-10-27 | Tareas programadas en **horario de CDMX** (07:00 alertas, 07:15 correo), no en UTC fijo | Irving | `app.tareas_pendientes_hoy()`, parámetros `HORA_*_CDMX` |
| 2026-10-27 | **Next.js 16** (16.4.3) en lugar de 15, a criterio del desarrollo. Prisma 7.10 | Irving → Claude | `package.json` |
| 2026-10-27 | Se mantiene Prisma; RLS se aplica con `conUsuario()` (transacción con claims + rol `authenticated`) | Claude (recomendación aprobada) | `lib/db/prisma.ts` |

## Pendientes de la sección 14.3 (con su valor por defecto ya cargado)

Base del 30% = depósito neto · base del 5% = la misma del honorario · reparto del socio sobre subtotal ·
escalón de referidos 3 a 10 con honorario cobrado · sin comisión en pensiones · una sola serie `RP-` ·
día 46 = baja + 46 · Vercel + Supabase · retención 5 años · logotipo SVG pendiente.

## Infraestructura (27-oct-2026)

| Pieza | Valor |
| --- | --- |
| Supabase | Proyecto **RPD Control** (`mltmnsykoemwplsawsau`, us-east-1), organización Ganadineroconduciendo.com, plan Free |
| Migraciones aplicadas | 000 base · 100 init · 200 seguridad · 300 bitácora y reglas · 400 tareas y almacenamiento |
| Pendiente | 500 endurecer funciones (folio fuera de `public` + `search_path`): requiere confirmación |
| Datos iniciales | `supabase/seed.sql` (equivalente a `prisma/seed.ts`) |
| Auth | TOTP activo · registro público cerrado · sesiones 12 h/30 min no disponibles en plan Free (la app cierra por inactividad) |
| GitHub | `Place2work/rpd-control` (privado) |
| Vercel | Proyecto `rpd-control`, equipo place2work (Hobby; Pro para uso comercial) |
