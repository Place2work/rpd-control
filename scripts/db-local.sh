#!/usr/bin/env bash
# Crea (o recrea) una base local con el simulador de Supabase, las migraciones y el seed.
# Uso: scripts/db-local.sh [nombre_bd]   (por defecto rpd_dev)
set -euo pipefail
BD="${1:-rpd_dev}"
URL_ADMIN="${PG_ADMIN_URL:-postgresql://rpd:rpd@localhost:5432/postgres}"
URL="postgresql://rpd:rpd@localhost:5432/${BD}"

psql "$URL_ADMIN" -qc "DROP DATABASE IF EXISTS ${BD} WITH (FORCE)" -c "CREATE DATABASE ${BD}"
psql "$URL" -q -v ON_ERROR_STOP=1 -f "$(dirname "$0")/supabase-local-stub.sql"
DIRECT_URL="$URL" DATABASE_URL="$URL" npx prisma migrate deploy
DIRECT_URL="$URL" DATABASE_URL="$URL" npx prisma db seed
echo "Base ${BD} lista: ${URL}"

# Usuario Director de demostración (RPD_DEMO_SIN_AUTH=1): mismo id que SESION_DEMO.
psql "$URL" -q -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-000000000000', 'demo@local') ON CONFLICT DO NOTHING;
INSERT INTO public.usuarios (id, nombre, email, rol) VALUES ('00000000-0000-0000-0000-000000000000', 'Irving (demo)', 'demo@local', 'director') ON CONFLICT DO NOTHING;
SQL
