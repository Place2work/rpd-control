# Fase 0, paso 1: propuesta para aprobación

> **Aprobada el 27-oct-2026** con ajustes. Ver [DECISIONES.md](DECISIONES.md).

27 de octubre de 2026. Sigue el prompt 13.2: estructura de carpetas, esquema de datos para todas las tablas de la sección 5 y lo que hay que decidir antes de crear el proyecto. **No hay código de la app todavía.**

## 1. Revisión de la especificación

### 1.1 Casos de prueba (sección 14.1)

Recalculé los 13 casos con aritmética decimal (no `float`). **Los 13 cuadran al centavo** con lo que dice el documento:

| # | Cálculo independiente | ¿Coincide? |
| --- | --- | --- |
| T1 | A = 15,000.00 · 60.0 sem · honorario 4,500 = 3,879.31 + 620.69 | ✅ |
| T2 | A topada 35,662.20 · 71.3 sem | ✅ |
| T3 | A 12,600 (105.0) · B 6,900 (57.5) | ✅ |
| T4 | A 9,000 (18.0) · B 27,000 (54.0) | ✅ |
| T5 | 2026-10-01 + 46 = 2026-11-16 | ✅ |
| T6 | 15 días hábiles desde 2026-11-10 saltando el lunes 16-nov = 2026-12-02 | ✅ |
| T7 | 2022-03-15 + 5 años = 2027-03-15 | ✅ |
| T8 | Mínimo 2028 = 925; 950 − 40 = 910 → crítica | ✅ |
| T9 | 900 sem → 8 incrementos; 870 → 7 | ✅ |
| T11 | Subtotal 2,586.21 · IVA 413.79 · margen 2,086.21 | ✅ |
| T12 | 2,000 · 8,000 · 33,000 | ✅ |
| T13 | (2,586.21 − 500) × 0.40 = 834.48 · (3,000 − 500) × 0.40 = 1,000.00 | ✅ |
| 7.7 | 8,849.84 × 0.30 = 2,654.95 · tope A desde SBC 1,188.74 · UMA 117.31 × 30.4 = 3,566.22 | ✅ |

### 1.2 Hallazgos que cambian el diseño

| # | Hallazgo | Riesgo | Propuesta |
| --- | --- | --- | --- |
| H1 | **Prisma no respeta RLS por defecto.** Se conecta con un rol con privilegios, así que las políticas de la sección 3 no aplicarían y un vendedor podría ver casos ajenos (criterio 14.2 roto). | Alto | Cada consulta de usuario corre en una transacción que primero hace `set local role authenticated` y `set_config('request.jwt.claims', …)` (extensión de Prisma Client, patrón documentado por Supabase). El cliente "admin" sin RLS solo existe en la tarea de las 07:00 y en `/api/leads`. Lo cubre una prueba de Playwright que llama la API como vendedor. |
| H2 | **Los campos cifrados no se pueden buscar.** La sección 10.2 pide buscar por NSS y detectar duplicados por CURP/NSS, pero un campo cifrado no se puede buscar con `WHERE`. | Alto | Se guardan tres columnas: el valor cifrado (AES-256-GCM, llave en el gestor de secretos), un **hash HMAC** (`nss_hash`, `curp_hash`) para buscar y deduplicar, y los últimos 4 dígitos para el enmascarado. Ya está en el esquema. |
| H3 | Contradicción en 7.5: "cuenta < 3 años **sin posibilidad** de completarla" (definitivo) frente a "le faltan meses para los 3 años" (no todavía). Una cuenta siempre cumple años, así que no queda claro cuándo aplica el definitivo. | Medio | Hasta que decidas: cuenta < 3 años → `NO_TODAVIA` con la fecha de los 3 años, y `NO_ELEGIBLE_DEFINITIVO` solo para la constancia en ceros. **Necesito tu confirmación.** |
| H4 | "Último retiro vacío" significa dos cosas: *nunca ha retirado* y *no lo hemos verificado*. Con un solo campo, T10 (`APTO_BLOQUEADO`) no se puede resolver nunca. | Medio | Agregué `ultimo_retiro_verificado` (bool): vacío + verificado = nunca retiró → libre. |
| H5 | `pg_cron` trabaja en UTC. | Bajo | México no tiene horario de verano desde 2022: 07:00 CDMX = `0 13 * * *` UTC. Queda como parámetro. |
| H6 | En el documento la etapa se llama "Armando expediente" (6.1) y también "Integrando expediente" (8.1). | Bajo | Uso "Armando expediente" en todo. |
| H7 | El retiro y la pensión tienen embudos distintos (6.1 y 6.2), pero `casos.etapa` es un solo enum. | Bajo | Un solo enum con la unión de etapas, y cada `tipos_servicio` declara su `embudo`. La máquina de estados valida que la etapa pertenezca al embudo. |
| H8 | Next.js 15: para cuando empiece el desarrollo ya existe Next.js 16 estable. | Bajo | Recomiendo arrancar en 16 (mismo App Router). Si prefieres 15, se respeta. |

### 1.3 Tablas que agregué (no están en la sección 5)

- `historial_etapas`: entrada y salida de cada etapa, para el reporte de tiempo por etapa sin tener que leer eventos.
- `suspensiones_contrato`: periodos de inicio y fin. `dias_suspendidos` se calcula de aquí y así queda la evidencia.
- `afores`, `tipos_documento_servicio` (para `servicios_aplica`), `plantillas_mensaje`, `plantillas_contrato` y `solicitudes_arco`: los pide la sección 10.9 o la 12 pero no tienen tabla en la 5.
- `auditoria` en un esquema aparte. La app solo puede leerla; escribe el trigger `SECURITY DEFINER`. También guarda cada vez que alguien ve un dato completo (`VER_SENSIBLE`).
- `calculos.entradas` (JSON) y `calculos.fecha_calculo`: guardan lo que se usó en cada corrida, así un cálculo viejo se reproduce igual aunque cambie la UMA (criterio 14.2).

## 2. Estructura de carpetas

```text
rpd-control/
├─ CLAUDE.md
├─ docs/ESPECIFICACION.md · PROPUESTA_FASE0.md
├─ prisma/
│  ├─ schema.prisma            ← propuesto (valida con Prisma 6)
│  ├─ seed.ts                  parámetros, servicios, documentos, Afores, inhábiles 2026-27
│  └─ sql/                     lo que Prisma no modela
│     ├─ 001_folio.sql         secuencia + siguiente_folio() con prefijo/ancho de parámetros
│     ├─ 002_rls.sql           políticas por rol (sección 3) + exigir aal2 (2FA)
│     ├─ 003_auditoria.sql     triggers before/after en todas las tablas
│     ├─ 004_checks.sql        numero 1-6, iva = total − subtotal, no DELETE salvo Director
│     └─ 005_cron.sql          pg_cron 13:00 UTC → alertas
├─ src/
│  ├─ app/
│  │  ├─ (auth)/login · mfa
│  │  ├─ (app)/layout.tsx      barra lateral / barra inferior móvil
│  │  │  ├─ hoy/ prospectos/ casos/[id]/ calendario/ dinero/
│  │  │  ├─ comisiones/ reportes/ configuracion/
│  │  └─ api/leads/route.ts    POST con firma HMAC (fase 2)
│  ├─ lib/
│  │  ├─ reglas/               PURO: sin BD, sin new Date()
│  │  │  ├─ fechas.ts  retiro.ts  pension.ts  precalificacion.ts
│  │  │  ├─ honorarios.ts  comisiones.ts  etapas.ts  alertas.ts
│  │  │  ├─ parametros.ts      tipo Parametros + resolver por vigencia
│  │  │  └─ __tests__/         casos T1–T13
│  │  ├─ db/                   prisma.ts (cliente RLS) · admin.ts (solo servidor)
│  │  ├─ cripto/               cifrar/descifrar/hmac/enmascarar
│  │  ├─ auth/                 sesión, rol, require2FA
│  │  └─ pdf/                  plantillas con marca (11.4)
│  ├─ components/ui/           shadcn con tokens de la sección 11
│  └─ components/rpd/          Insignia de etapa, CuentaRegresiva46, BloqueCalculo…
├─ supabase/functions/alertas-diarias/   correo Resend 07:15
├─ public/brand/               logo-color.jpg (pendiente SVG y versión blanca)
└─ e2e/                        Playwright
```

## 3. Esquema de datos

El esquema está en `prisma/schema.prisma` y pasa `prisma validate`. Tiene 28 modelos: las tablas de la sección 5 y las de 1.3. Puntos clave:

- **Dinero:** `Decimal(14,2)`. **Semanas:** `Decimal(8,1)`. **Fechas de negocio:** `@db.Date`, sin hora, para que la zona horaria no mueva el día 46.
- **Folio:** `default(dbgenerated("public.siguiente_folio()"))`. Así no se repite aunque dos asesores creen casos al mismo tiempo.
- **Parámetros:** se identifican por `(clave, vigente_desde)`. `lib/reglas/parametros.ts` resuelve el valor vigente para la fecha `hoy` del cálculo.
- **Alertas:** `@@unique([clave_dedup, asignado_a])`, porque una misma regla avisa a varias personas (8.1).
- **Comisiones:** `pago_afore_id` para devengar por mensualidad en modalidad B, y `componente` para el esquema de fallecimiento.

## 4. Formato propuesto de `esquemas_comision.reglas`

```json
{ "tipo": "porcentaje", "pct": 0.05, "base": "monto_afore", "devenga": "pago_afore_y_cobro" }
{ "tipo": "escalonado_mensual", "escalones": [
    {"desde": 1, "hasta": 2, "monto": 1000}, {"desde": 3, "hasta": 10, "monto": 2000},
    {"desde": 11, "hasta": null, "monto": 3000}], "cuenta": "honorario_cobrado" }
{ "tipo": "reparto", "costo_admin": 500, "pct_socio": 0.40, "base": "subtotal_sin_iva" }
{ "tipo": "compuesto", "componentes": [
    {"clave": "pago_inicial", "fijo_param": "FALLEC_COMISION_INICIAL"},
    {"clave": "recuperado", "pct": 0.05},
    {"clave": "primera_mensualidad", "fijo_param": "FALLEC_COMISION_MENSUALIDAD"}] }
```

## 5. Antes de crear el proyecto necesito

1. **Aprobar** la estructura y el esquema, o decirme qué cambiar.
2. **H3:** cómo se trata una cuenta con menos de 3 años.
3. **Next.js 15 o 16** (H8).
4. **Supabase:** URL del proyecto y llaves, o crear el proyecto. Las llaves van en el gestor de secretos o en variables del entorno, **nunca en el chat ni en el repositorio**.
5. Si se queda **Prisma** con la capa de transacciones de H1, o se cambia a **Drizzle**, que define las políticas RLS en el mismo esquema. Mi recomendación es quedarnos con Prisma y H1: ya está en CLAUDE.md, y el riesgo se controla con una prueba automática.

Las demás decisiones pendientes de la sección 14.3 tienen un valor por defecto y no frenan la fase 0.
