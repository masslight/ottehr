#!/usr/bin/env bash
#
# Flaky E2E test-fixing loop driver.
#
# Runs a FRESH, context-clean `claude -p` session each iteration. Because each
# iteration is a brand-new process, the loop can run for hours without the
# context exhaustion you'd hit in a single long-lived session. Knowledge is
# carried between iterations via the on-disk progress file (state/FLAKY_PROGRESS.md),
# NOT via the model's context window — that's the whole trick.
#
# Usage:
#   scripts/flaky-loop/driver.sh
#
# Environment overrides:
#   MAX_ITERS=50      number of iterations before the loop stops
#   MODEL=...         model id (default claude-opus-4-8; claude-sonnet-4-6 is cheaper)
#   ITER_TIMEOUT=7200 hard cap (seconds) per iteration; killed if exceeded
#   BACKOFF=60        seconds to wait after a non-zero claude exit (rate limits etc.)
#
# Stop early at any time by creating the stop file:
#   touch scripts/flaky-loop/state/STOP
#
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$HERE/../.." && pwd)"
STATE_DIR="$HERE/state"
LOG_DIR="$HERE/logs"
PROMPT_FILE="$HERE/prompt.md"
PROGRESS_FILE="$STATE_DIR/FLAKY_PROGRESS.md"
STOP_FILE="$STATE_DIR/STOP"

MAX_ITERS="${MAX_ITERS:-50}"
MODEL="${MODEL:-claude-opus-4-8}"
ITER_TIMEOUT="${ITER_TIMEOUT:-7200}"
BACKOFF="${BACKOFF:-60}"

mkdir -p "$STATE_DIR" "$LOG_DIR"

if [[ ! -f "$PROMPT_FILE" ]]; then
  echo "FATAL: prompt file not found at $PROMPT_FILE" >&2
  exit 1
fi

if [[ ! -f "$PROGRESS_FILE" ]]; then
  cp "$HERE/FLAKY_PROGRESS.template.md" "$PROGRESS_FILE"
  echo "Initialized progress file at $PROGRESS_FILE"
fi

cd "$REPO_ROOT"
echo "Driver starting in $REPO_ROOT (model=$MODEL, max_iters=$MAX_ITERS)"

for (( i=1; i<=MAX_ITERS; i++ )); do
  if [[ -f "$STOP_FILE" ]]; then
    echo "STOP file present ($STOP_FILE) — exiting loop."
    rm -f "$STOP_FILE"
    break
  fi

  ts="$(date +%Y%m%d-%H%M%S)"
  log="$LOG_DIR/iter-$(printf '%03d' "$i")-$ts.log"
  echo "==================================================================="
  echo "=== Iteration $i / $MAX_ITERS @ $ts"
  echo "=== Log: $log"
  echo "==================================================================="

  # Each iteration is a fresh session. --dangerously-skip-permissions is what
  # lets it run unattended; see README for a safer allowlist alternative.
  timeout "$ITER_TIMEOUT" claude -p "$(cat "$PROMPT_FILE")" \
      --model "$MODEL" \
      --dangerously-skip-permissions \
      2>&1 | tee "$log"
  code=${PIPESTATUS[0]}

  if [[ $code -eq 124 ]]; then
    echo "Iteration $i timed out after ${ITER_TIMEOUT}s (killed)."
  elif [[ $code -ne 0 ]]; then
    echo "Iteration $i: claude exited $code. Backing off ${BACKOFF}s before next."
    sleep "$BACKOFF"
  fi
done

echo "Loop finished after up to $MAX_ITERS iterations. See $LOG_DIR and $PROGRESS_FILE."
