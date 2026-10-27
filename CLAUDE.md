# RPD Control — CRM interno de RetiroPorDesempleo.com

## Fuente de verdad
- La especificación completa está en docs/ESPECIFICACION.md. Si el código contradice
  ese documento, manda el documento. Pregunta antes de inventar una regla de negocio.
- Las decisiones tomadas después de la especificación están en docs/DECISIONES.md y
  prevalecen sobre ella.

## Stack
- Next.js 16 (App Router, Server Actions, Cache Components, `proxy.ts` en lugar de middleware),
  TypeScript estricto, Tailwind 4, componentes estilo shadcn/ui, lucide-react,
  Supabase (Postgres, Auth con 2FA, Storage, RLS), Prisma 7 (adapter-pg, prisma.config.ts),
  Zod, React Hook Form, TanStack Table, date-fns 4 + @date-fns/tz, Recharts, Vitest, Playwright.
- Next 16 cambió APIs: antes de escribir código de Next, revisa node_modules/next/dist/docs/.

## Reglas de código
- Todas las reglas de negocio viven en src/lib/reglas/ como funciones puras.
  Reciben `hoy` y `parametros` como argumentos. Nunca leen la BD ni new Date().
- Ningún porcentaje, UMA, plazo o monto se escribe en el código: sale de la tabla
  `parametros` con vigencia.
- Dinero en centavos (enteros) o Decimal; nunca float. Redondeo a 2 decimales al final.
- Zona horaria: America/Mexico_City en todo cálculo de fechas (src/lib/tiempo.ts).
- Toda la interfaz en español de México, tuteo.
- Datos sensibles (NSS, CURP, CLABE) cifrados (src/lib/cripto) con hash HMAC para buscar;
  el dato completo solo con verDatoSensible(), que deja bitácora.
- **Toda consulta hecha a nombre de un usuario pasa por `conUsuario()`** (src/lib/db/prisma.ts)
  para que aplique RLS. `prismaSistema` solo para la tarea diaria, /api/leads y catálogos.
- Nunca crear campos para contraseñas de portales de terceros.
- Nadie borra: se archiva con motivo. Las migraciones no conceden DELETE.
- Cada regla nueva lleva pruebas en Vitest con los casos de la sección 14.
- Cambios de seguridad o de esquema llevan prueba en tests/db/ (npm run test:db).

## Marca
- Azul #004AAD (primario), verde #5E9E3A (éxito/acento), texto verde #3F7A24.
- Poppins para títulos y montos, Inter para texto. Tokens en src/app/globals.css.

## Comandos
- npm run dev · npm run build · npm run lint · npm run typecheck
- npm run test (reglas) · npm run test:db (RLS, requiere `npm run db:local -- rpd_test`) · npm run test:e2e
- npm run db:migrate · npm run db:seed · npm run db:local -- <bd>
