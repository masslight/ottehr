#!/usr/bin/env bash

# Fast local setup: applies core resources first (~640 resources, ~15 min),
# then provisions a default admin user, then applies payer resources in the
# background (~3,971 resources, ~1-2 hours).
#
# Usage: ./apply-local-fast.sh [environment]
#   environment defaults to "local"

set -euo pipefail

export ENV=${1:-local}

echo "=== Ottehr Fast Local Setup ==="
echo "Environment: ${ENV}"
echo ""

# ── Phase 0: Bundle, generate, and init ──────────────────────────────────────

echo "▶ Bundling zambdas..."
ENV="${ENV}" npm run bundle-zambdas

echo "▶ Generating terraform config..."
ENV="${ENV}" npm run generate

rm -f aws_override.tf
rm -f gcp_override.tf
npm run terraform-init
terraform workspace select "${ENV}" 2>/dev/null || terraform workspace new "${ENV}"
npm run terraform-init

# ── Phase 1: Apply core resources (excluding payers) ─────────────────────────

PAYER_DIR="$(pwd)/oystehr/.payers-deferred"
mkdir -p "${PAYER_DIR}"

echo ""
echo "▶ Phase 1: Applying core resources (excluding payer organizations)..."
echo "  This creates apps, roles, zambdas, FHIR resources (~640 resources)."
echo "  Expected time: ~15 minutes."
echo ""

# Move payer files out so terraform doesn't see them
mv oystehr/payer-fhir-resources.tf.json "${PAYER_DIR}/" 2>/dev/null || true
mv oystehr/payer-outputs.tf.json "${PAYER_DIR}/" 2>/dev/null || true

terraform apply -no-color -parallelism=20 -var-file="${ENV}.tfvars" -auto-approve

echo ""
echo "✓ Core resources applied successfully!"
echo ""

# ── Provision default admin user ─────────────────────────────────────────────

echo "▶ Provisioning default admin user (demo@ottehr.com)..."
tsx create-default-admin.ts "${ENV}" || echo "⚠ Admin user provisioning failed (may already exist). Continuing..."

# ── Phase 2: Apply payer resources in background ─────────────────────────────

# Move payer files back
mv "${PAYER_DIR}/payer-fhir-resources.tf.json" oystehr/ 2>/dev/null || true
mv "${PAYER_DIR}/payer-outputs.tf.json" oystehr/ 2>/dev/null || true
rmdir "${PAYER_DIR}" 2>/dev/null || true

echo ""
echo "▶ Phase 2: Applying payer organization resources in background..."
echo "  This creates ~3,971 insurance payer organizations."
echo "  Running in background — you can start the apps now."
echo ""

PAYER_LOG="$(pwd)/payer-apply.log"

nohup bash -c "terraform apply -no-color -parallelism=20 -var-file='${ENV}.tfvars' -auto-approve > '${PAYER_LOG}' 2>&1 && echo '✓ Payer resources applied successfully!' >> '${PAYER_LOG}' || echo '✗ Payer apply failed — check ${PAYER_LOG}' >> '${PAYER_LOG}'" &
PAYER_PID=$!

echo "  Payer apply PID: ${PAYER_PID}"
echo "  Log: ${PAYER_LOG}"
echo "  Monitor with: tail -f ${PAYER_LOG}"
echo ""
echo "=== Setup Complete ==="
echo ""
echo "You can now start the apps from the repo root:"
echo "  npm run apps:start:no-apply"
echo ""
echo "  Patient Portal: http://localhost:3002"
echo "  EHR:            http://localhost:4002  (login: demo@ottehr.com / Oystehr1!)"
echo "  Zambdas API:    http://localhost:3000"
echo ""
echo "Payer organizations are loading in the background."
echo "Insurance features will become available as payers finish provisioning."
