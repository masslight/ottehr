#!/usr/bin/env bash
#
# state-restore.sh — restore a snapshot taken by ./state-snapshot.sh, re-adding the
# seed Locations/Schedules to an environment's Terraform state so a later `develop`
# apply sees them as existing and does NOT recreate them as duplicates.
#
# Usage:
#   ./state-restore.sh <env> <snapshot-file>
#   e.g. ./state-restore.sh development .state-backups/pre-review-development-20260729-2210.tfstate
#
# Safety:
#   * Aborts if the snapshot's lineage != the current remote state's lineage
#     (that means the state was recreated; forcing an old snapshot over it could be
#     destructive — investigate manually instead).
#   * Pushes forward monotonically (serial = current+1) so no --force is needed and
#     the serial never regresses.
#   * Requires typed confirmation of the environment name.
#   * Any state changes made AFTER the snapshot are discarded — run only once the
#     deploy runway is clear (no other applies in flight against this env).
#
set -euo pipefail

ENV="${1:-}"
BACKUP_FILE="${2:-}"

if [ -z "$ENV" ] || [ -z "$BACKUP_FILE" ]; then
  echo "ERROR: usage: ./state-restore.sh <env> <snapshot-file>" >&2
  exit 1
fi
# Resolve the snapshot path relative to the invocation dir before we cd.
case "$BACKUP_FILE" in
  /*) ;;
  *) BACKUP_FILE="$PWD/$BACKUP_FILE" ;;
esac

cd "$(dirname "$0")"

REMOVED_BLOCKS="oystehr/removed-locations.tf.json"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: snapshot file not found: ${BACKUP_FILE}" >&2
  exit 1
fi
if ! jq -e . "$BACKUP_FILE" >/dev/null 2>&1; then
  echo "ERROR: snapshot is not valid JSON: ${BACKUP_FILE}" >&2
  exit 1
fi
if [ ! -f backend.config ]; then
  echo "ERROR: backend.config missing — cannot init the remote backend." >&2
  exit 1
fi

echo "==> Initializing backend + selecting workspace '${ENV}'"
terraform init -input=false --backend-config=./backend.config >/dev/null
terraform workspace select "$ENV"

CURRENT_STATE="$(mktemp)"
RESTORE_FILE="$(mktemp)"
trap 'rm -f "$CURRENT_STATE" "$RESTORE_FILE"' EXIT

echo "==> Pulling current state for '${ENV}'"
terraform state pull > "$CURRENT_STATE"

seed_present() { # $1 = state file
  jq -n --slurpfile s "$1" --slurpfile r "$REMOVED_BLOCKS" '
    ($r[0].removed | map(.from | sub("^oystehr_fhir_resource\\.";""))) as $names
    | [ $s[0].resources[]? | select(.type=="oystehr_fhir_resource") | .name ] as $have
    | ($names | map(select(. as $n | $have | index($n))) | length)'
}

BK_LINEAGE="$(jq -r '.lineage' "$BACKUP_FILE")"
CUR_LINEAGE="$(jq -r '.lineage' "$CURRENT_STATE")"
BK_SERIAL="$(jq -r '.serial' "$BACKUP_FILE")"
CUR_SERIAL="$(jq -r '.serial' "$CURRENT_STATE")"
SEED_TOTAL="$(jq -r '.removed | length' "$REMOVED_BLOCKS")"
BK_SEED="$(seed_present "$BACKUP_FILE")"
CUR_SEED="$(seed_present "$CURRENT_STATE")"

echo
echo "  env/workspace:     ${ENV}"
echo "  current lineage:   ${CUR_LINEAGE}"
echo "  snapshot lineage:  ${BK_LINEAGE}"
echo "  current serial:    ${CUR_SERIAL}"
echo "  snapshot serial:   ${BK_SERIAL}"
echo "  seed resources — current: ${CUR_SEED}/${SEED_TOTAL}, snapshot: ${BK_SEED}/${SEED_TOTAL}"
echo

if [ "$BK_LINEAGE" != "$CUR_LINEAGE" ]; then
  echo "ABORT: snapshot lineage does not match the current remote state." >&2
  echo "       The state was recreated since the snapshot; forcing the old snapshot" >&2
  echo "       over it could be destructive. Investigate manually before restoring." >&2
  exit 1
fi

if [ "$BK_SEED" -le "$CUR_SEED" ]; then
  echo "NOTE: current state already tracks >= the seed resources in the snapshot" >&2
  echo "      (current ${CUR_SEED}, snapshot ${BK_SEED}). There may be nothing to restore." >&2
  echo >&2
fi

echo "This OVERWRITES the '${ENV}' remote state with the snapshot, re-adding"
echo "${BK_SEED} seed resource(s). State changes made after the snapshot are discarded."
echo "Make sure no other applies are running against '${ENV}'."
echo
printf "Type the environment name (%s) to confirm: " "$ENV"
read -r CONFIRM
if [ "$CONFIRM" != "$ENV" ]; then
  echo "Confirmation did not match. Aborting (no changes made)."
  exit 1
fi

# Same lineage, serial current+1 → `state push` accepts without --force and the
# serial moves forward rather than regressing.
jq --argjson s "$((CUR_SERIAL + 1))" '.serial = $s' "$BACKUP_FILE" > "$RESTORE_FILE"

echo "==> Pushing restored state (serial $((CUR_SERIAL + 1)))"
terraform state push "$RESTORE_FILE"

VERIFY_STATE="$(mktemp)"
terraform state pull > "$VERIFY_STATE"
NEW_SEED="$(seed_present "$VERIFY_STATE")"
NEW_SERIAL="$(jq -r '.serial' "$VERIFY_STATE")"
rm -f "$VERIFY_STATE"

echo
echo "==> Restore complete. Seed resources now tracked: ${NEW_SEED}/${SEED_TOTAL} (serial ${NEW_SERIAL})."
echo "    A subsequent 'develop' apply should now see them as existing (no recreate)."
