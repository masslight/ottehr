#!/bin/sh
# Writes Ottehr app config and zambda secrets from env (Cloud Run --set-secrets) to the paths
# expected at runtime, then starts the zambdas local API server.
set -eu

# ENV must be set before we know the target filename
export ENV="${ENV:-local}"

mkdir -p /app/config/.env /app/packages/zambdas/.env

# Write from env var only when the file isn't already populated (e.g., via Cloud Run
# secret volume mount, which makes the parent dir read-only and would fail any write).
if [ -n "${OTTEHR_CONFIG:-}" ] && [ ! -s "/app/config/.env/local.json" ]; then
  printf '%s' "$OTTEHR_CONFIG" > "/app/config/.env/local.json"
fi

if [ -n "${ZAMBDA_SECRETS:-}" ] && [ ! -s "/app/packages/zambdas/.env/zambda-secrets-${ENV}.json" ]; then
  printf '%s' "$ZAMBDA_SECRETS" > "/app/packages/zambdas/.env/zambda-secrets-${ENV}.json"
fi

if [ ! -f "/app/packages/zambdas/.env/zambda-secrets-${ENV}.json" ]; then
  echo "Missing config: /app/packages/zambdas/.env/zambda-secrets-${ENV}.json is required. Set ZAMBDA_SECRETS (e.g. via Cloud Run --set-secrets) or mount the file." >&2
  exit 1
fi

cd /app
exec node --import tsx ./packages/zambdas/src/local-server/index.ts
