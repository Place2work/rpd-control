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
