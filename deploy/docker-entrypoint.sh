#!/bin/sh
# Writes Ottehr app config and zambda secrets from env (Cloud Run --set-secrets) to the paths
# expected at runtime, then starts the zambdas local API server.
set -eu
mkdir -p /app/config/.env /app/packages/zambdas/.env
if [ -n "${OTTEHR_CONFIG:-}" ]; then
  printf '%s' "$OTTEHR_CONFIG" > /app/config/.env/local.json
fi
if [ -n "${ZAMBDA_SECRETS:-}" ]; then
  printf '%s' "$ZAMBDA_SECRETS" > /app/packages/zambdas/.env/zambda-secrets-local.json
fi
if [ ! -f /app/config/.env/local.json ] || [ ! -f /app/packages/zambdas/.env/zambda-secrets-local.json ]; then
  echo "Missing config: local.json and zambda-secrets-local.json are required. Set OTTEHR_CONFIG and ZAMBDA_SECRETS (e.g. via Cloud Run --set-secrets) or mount files." >&2
  exit 1
fi
export ENV="${ENV:-local}"
cd /app
# Default in packages/zambdas/src/local-server/utils.ts: .env/zambda-secrets-${ENV}.json
exec node --import tsx ./packages/zambdas/src/local-server/index.ts
