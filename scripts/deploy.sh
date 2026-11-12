#!/usr/bin/env bash
# Deploy CSolution on the production server.
#
# Run from the repository root on the server:
#   ./scripts/deploy.sh
#
# The script pulls the latest commit, rebuilds the images, applies any new
# database migration and restarts the app. The database container keeps
# running, so an active shop is only interrupted while the app restarts.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Pulling latest changes"
git pull --ff-only

echo "==> Building images"
docker compose build app migrate

echo "==> Applying migrations"
docker compose --profile tools run --rm migrate

echo "==> Restarting app"
docker compose up -d app

echo "==> Status"
docker compose ps
