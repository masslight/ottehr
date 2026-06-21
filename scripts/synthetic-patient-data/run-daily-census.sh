#!/usr/bin/env bash
# Daily synthetic-census runner (launchd/cron entry point). Preflight-gates on the
# synth feature being present, boots an EPHEMERAL local zambda server on a
# dedicated port, runs the census, then tears the server down. Logs every run.
#
#   scripts/synthetic-patient-data/run-daily-census.sh [--env demo] [--count 40] [--dry]
#
# Default env: demo. Refuses (with actionable guidance) when the checked-out
# branch doesn't contain the synth harness.
set -uo pipefail

# ── Resolve paths ─────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$SCRIPT_DIR/../.." && pwd)"
CENSUS="$SCRIPT_DIR/synth-daily-census.ts"
ARCHETYPES="$SCRIPT_DIR/population/archetypes.ts"
SIGN_ZAMBDA="$REPO/packages/zambdas/src/ehr/sign-appointment/index.ts"
LOCAL_SERVER="$REPO/packages/zambdas/src/local-server/index.ts"

PORT="${CENSUS_PORT:-3010}"
ENVNAME="demo"
EXTRA_ARGS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --env) ENVNAME="$2"; shift 2 ;;
    *) EXTRA_ARGS+=("$1"); shift ;;
  esac
done

CREDS="$REPO/packages/zambdas/.env/${ENVNAME}.json"
SECRETS="$REPO/packages/zambdas/.env/zambda-secrets-${ENVNAME}.json"
LOG_DIR="$SCRIPT_DIR/.census-logs"
mkdir -p "$LOG_DIR"
STAMP="$(date +%Y-%m-%d_%H%M%S)"
LOG="$LOG_DIR/census-${ENVNAME}-${STAMP}.log"
SERVERLOG="$LOG_DIR/server-${ENVNAME}-${STAMP}.log"
RERUN="$SCRIPT_DIR/run-daily-census.sh --env ${ENVNAME}"

log() { echo "[$(date '+%H:%M:%S')] $*" | tee -a "$LOG"; }

abort_wrong_branch() {
  {
    echo "[synth-daily-census] ABORTED $(date '+%Y-%m-%d %H:%M') — synth harness not found"
    echo "on the checked-out branch (current: $(git -C "$REPO" rev-parse --abbrev-ref HEAD 2>/dev/null))."
    echo
    echo "This job needs the synth data feature (otr-2435): synth-daily-census.ts +"
    echo "population/archetypes.ts + the sign-appointment fix."
    echo
    echo "To run it, EITHER:"
    echo "  • merge otr-2435 into develop/main (then any branch works), OR"
    echo "  • check out a branch that has it:"
    echo "        git -C $REPO checkout dabrams/otr-2435-get-realistic-test-data-in-demo-and-lower-envs"
    echo
    echo "Re-run immediately against demo after fixing:"
    echo "        $RERUN"
  } | tee -a "$LOG" >&2
  exit 2
}

abort_missing_creds() {
  {
    echo "[synth-daily-census] ABORTED $(date '+%Y-%m-%d %H:%M') — missing env files for '${ENVNAME}':"
    [[ -f "$CREDS" ]]   || echo "  • $CREDS (M2M creds)"
    [[ -f "$SECRETS" ]] || echo "  • $SECRETS (zambda secrets)"
    echo
    echo "Provide them (never inline secrets), then re-run:  $RERUN"
  } | tee -a "$LOG" >&2
  exit 3
}

# ── Preflight (no server needed) ──────────────────────────────────────────────
log "preflight: env=${ENVNAME}, port=${PORT}, repo=${REPO}"
[[ -f "$CENSUS" && -f "$ARCHETYPES" && -f "$SIGN_ZAMBDA" && -f "$LOCAL_SERVER" ]] || abort_wrong_branch
[[ -f "$CREDS" && -f "$SECRETS" ]] || abort_missing_creds

# ── Ephemeral server ──────────────────────────────────────────────────────────
if lsof -ti ":$PORT" >/dev/null 2>&1; then
  log "ABORT: port $PORT already in use — refusing to reuse an unknown server. Free it and re-run: $RERUN"
  exit 4
fi

log "starting ephemeral zambda server (ENV=${ENVNAME}) on :$PORT …"
# The local server logs each request's full secrets object. Stream its output
# through a redaction filter so no plaintext secret value (any *_SECRET / *_KEY /
# *_CLIENT / *_TOKEN / *_PASSWORD field) is ever written to disk. The server log
# is also deleted on success below (kept only on failure, redacted, for debugging).
REDACT='s/("[A-Z0-9_]*(SECRET|KEY|CLIENT|TOKEN|PASSWORD)[A-Z0-9_]*" *: *")[^"]*/\1<redacted>/g'
( cd "$REPO/packages/zambdas" && PORT="$PORT" ENV="$ENVNAME" npx tsx src/local-server/index.ts -- "secrets=.env/zambda-secrets-${ENVNAME}.json" ) > >(sed -E "$REDACT" > "$SERVERLOG") 2>&1 &
SERVER_PID=$!

cleanup() {
  log "tearing down server (pid $SERVER_PID) …"
  kill "$SERVER_PID" 2>/dev/null
  lsof -ti ":$PORT" 2>/dev/null | xargs kill -9 2>/dev/null
}
trap cleanup EXIT

# Wait for readiness (≤90s).
READY=""
for i in $(seq 1 45); do
  if curl -s -o /dev/null "http://localhost:$PORT/local" 2>/dev/null; then READY=1; break; fi
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then log "ABORT: server process exited during boot — see $SERVERLOG"; exit 5; fi
  sleep 2
done
[[ -n "$READY" ]] || { log "ABORT: server not ready after 90s — see $SERVERLOG"; exit 5; }
log "server ready."

# ── Run the census ────────────────────────────────────────────────────────────
log "running census …"
( cd "$REPO" && npx env-cmd -f "$CREDS" npx tsx "$CENSUS" --env "$ENVNAME" --zambda-api "http://localhost:$PORT/local" ${EXTRA_ARGS[@]+"${EXTRA_ARGS[@]}"} ) 2>&1 | tee -a "$LOG"
RC="${PIPESTATUS[0]}"
log "census exit code: $RC  (log: $LOG)"

# ── Log hygiene ───────────────────────────────────────────────────────────────
# Drop the (redacted) server log on success — it's large and only useful for
# debugging a failure. Then prune anything older than 7 days so the dir doesn't
# grow unbounded under the daily cron.
sync 2>/dev/null
if [[ "$RC" -eq 0 ]]; then
  rm -f "$SERVERLOG"
else
  log "server log kept for debugging (secrets redacted): $SERVERLOG"
fi
find "$LOG_DIR" -type f -name '*.log' -mtime +7 -delete 2>/dev/null

exit "$RC"
