#!/usr/bin/env bash
#
# state-snapshot.sh — capture an environment's Terraform state BEFORE deploying an
# unmerged branch that removes the seed Locations/Schedules from state (the Phase-1
# self-service-Locations migration in oystehr/removed-locations.tf.json).
#
# Why: those `removed` blocks use `destroy = false`, so the resources stay in FHIR
# but leave TF state. A later `develop` apply — whose config still declares them —
# then sees "in config, not in state" and recreates them (duplicates). Restoring
# this snapshot afterward puts them back into state so that never happens.
#
# Usage:   ./state-snapshot.sh <env>          e.g.  ./state-snapshot.sh development
# Pairs with ./state-restore.sh. See TERRAFORM-STATE-SNAPSHOT.md.
#
set -euo pipefail

cd "$(dirname "$0")"

ENV="${1:-}"
if [ -z "$ENV" ]; then
  echo "ERROR: environment is required.  Usage: ./state-snapshot.sh <env>" >&2
  exit 1
fi

REMOVED_BLOCKS="oystehr/removed-locations.tf.json"
BACKUP_DIR=".state-backups"
BACKUP_FILE="${BACKUP_DIR}/pre-review-${ENV}-$(date +%Y%m%d-%H%M%S).tfstate"

if [ ! -f backend.config ]; then
  echo "ERROR: backend.config missing — cannot init the remote backend." >&2
  exit 1
fi
if [ ! -f "$REMOVED_BLOCKS" ]; then
  echo "ERROR: ${REMOVED_BLOCKS} not found — are you on the migration branch?" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

echo "==> Initializing backend + selecting workspace '${ENV}'"
terraform init -input=false --backend-config=./backend.config >/dev/null
terraform workspace select "$ENV"

echo "==> Pulling current state for '${ENV}'"
terraform state pull > "$BACKUP_FILE"

if [ ! -s "$BACKUP_FILE" ] || ! jq -e . "$BACKUP_FILE" >/dev/null 2>&1; then
  echo "ERROR: pulled state is empty or not valid JSON. Aborting." >&2
  rm -f "$BACKUP_FILE"
  exit 1
fi

# How many of the migration's seed resources are currently tracked in state?
seed_present() { # $1 = state file
  jq -n --slurpfile s "$1" --slurpfile r "$REMOVED_BLOCKS" '
    ($r[0].removed | map(.from | sub("^oystehr_fhir_resource\\.";""))) as $names
    | [ $s[0].resources[]? | select(.type=="oystehr_fhir_resource") | .name ] as $have
    | ($names | map(select(. as $n | $have | index($n))) | length)'
}

SERIAL="$(jq -r '.serial' "$BACKUP_FILE")"
LINEAGE="$(jq -r '.lineage' "$BACKUP_FILE")"
TOTAL_RES="$(jq -r '[.resources[]?] | length' "$BACKUP_FILE")"
SEED_TOTAL="$(jq -r '.removed | length' "$REMOVED_BLOCKS")"
SEED_PRESENT="$(seed_present "$BACKUP_FILE")"

echo
echo "  Snapshot written: $(pwd)/${BACKUP_FILE}"
echo "  workspace/env:    ${ENV}"
echo "  state serial:     ${SERIAL}"
echo "  state lineage:    ${LINEAGE}"
echo "  total resources:  ${TOTAL_RES}"
echo "  seed resources tracked in state: ${SEED_PRESENT} / ${SEED_TOTAL}"
echo

if [ "$SEED_PRESENT" -eq 0 ]; then
  echo "WARNING: none of the seed Locations/Schedules are tracked in this state." >&2
  echo "         Either this env was already migrated (removed blocks already applied)" >&2
  echo "         — in which case deploying this branch changes nothing about them and" >&2
  echo "         no restore is needed — or you snapshotted the wrong environment." >&2
  echo >&2
fi

echo "After the review, restore with:"
echo "  ./state-restore.sh ${ENV} $(pwd)/${BACKUP_FILE}"
