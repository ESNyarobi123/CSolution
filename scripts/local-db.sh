#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
db_name=csolution_shop
if [ ! -f .env ]; then
  if ! psql -d postgres -Atqc "SELECT 1 FROM pg_database WHERE datname = '$db_name'" | grep -qx 1; then
    createdb "$db_name"
  fi
  umask 077
  admin_password="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(12).toString("base64url"))')"
  cat > .env <<ENV
PGDATABASE=$db_name
PGHOST=/tmp
CSOLUTION_DEMO=1
CSOLUTION_ADMIN_EMAIL=admin@csolution.local
CSOLUTION_ADMIN_PASSWORD=$admin_password
ENV
fi
npm run db:setup
