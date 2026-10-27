# RPD Control

CRM interno de RetiroPorDesempleo.com. Especificación: [docs/ESPECIFICACION.md](docs/ESPECIFICACION.md).

**Estado: fase 0 (cimientos).** Autenticación con 2FA, roles con RLS, bitácora, sistema de diseño,
pantallas vacías de los módulos, parámetros y catálogos. Sin lógica de negocio todavía.

## Puesta en marcha con Supabase

1. **Proyecto.** Crea un proyecto en Supabase (región `us-east-1` o la más cercana a México).
2. **Variables.** Copia `.env.example` a `.env` y `.env.local` y llénalas. Genera las llaves con
   `openssl rand -base64 32` y **guárdalas en un gestor de secretos**: sin `CIFRADO_LLAVE` los
   datos cifrados no se recuperan.
3. **Auth** (Dashboard → Authentication):
   - *Multi-Factor* → habilita **TOTP**.
   - *Sessions* → time-box **12 h** e inactividad **30 min** (requiere plan Pro; la app trae
     además un cierre por inactividad en el navegador).
   - *Sign In / Providers* → desactiva el registro público (*Allow new users to sign up*).
4. **Extensiones** (Database → Extensions): `pg_cron` y `pg_net`.
5. **Migraciones y catálogos:** `npm install && npm run db:migrate && npm run db:seed`.
6. **Vault** (SQL Editor):
   ```sql
   select vault.create_secret('https://TU-DOMINIO', 'rpd_app_url');
   select vault.create_secret('EL-MISMO-CRON_SECRETO-DEL-.env', 'rpd_cron_secreto');
   ```
7. **Tu usuario:** `npx tsx scripts/crear-director.ts tu@correo "Irving Ortega Valois"`.
   Acepta la invitación, define contraseña y escanea el QR con tu app autenticadora.
8. **Despliegue:** Vercel → importa el repositorio y carga las mismas variables (sin `RPD_DEMO_SIN_AUTH`).

## Desarrollo local sin Supabase

```bash
npm install
npm run db:local -- rpd_dev            # Postgres local + simulador de Supabase + migraciones + seed
RPD_DEMO_SIN_AUTH=1 npm run dev        # revisa el diseño como Director (solo en local)
npm run test                           # reglas puras
npm run db:local -- rpd_test && npm run test:db   # RLS, bitácora y restricciones
npm run build && npm run test:e2e      # flujos en navegador
```

## Seguridad, en corto

- 2FA obligatorio: sin sesión `aal2`, RLS no devuelve ni una fila.
- RLS en todas las tablas; Prisma la respeta porque cada consulta corre con `conUsuario()`.
- NSS, CURP y CLABE cifrados (AES-256-GCM) con índice ciego HMAC para buscar. El rol de la app
  no puede leer las columnas cifradas: el dato completo sale solo con `app.ver_dato_sensible()`,
  que deja bitácora.
- Nadie borra; la bitácora no se puede editar ni borrar, ni con superusuario.
- Expedientes en el bucket privado `expedientes`, rutas `{caso_id}/{uuid}`.
