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
#   MODEL=...         model id (default claude-opus-4-8; claude-fable-5 is stronger,
#                     claude-sonnet-4-6 is cheaper)
#   ITER_TIMEOUT=7200 hard cap (seconds) per iteration; killed if exceeded
#   BACKOFF=60        seconds to wait after a non-zero claude exit (rate limits etc.)
#   STREAM=1          live, readable streaming of each session's steps (0 = plain final output)
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
MODEL="${MODEL:-claude-sonnet-4-6}"
ITER_TIMEOUT="${ITER_TIMEOUT:-7200}"
BACKOFF="${BACKOFF:-60}"
STREAM="${STREAM:-1}"           # 1 = live, readable streaming of each session's steps; 0 = plain final output

mkdir -p "$STATE_DIR" "$LOG_DIR"

# Single-instance lock: a second driver editing the same working tree would
# race the first on file edits and git commits. mkdir is atomic and portable
# (no flock on macOS). A stale lock from a crashed run is detected via its pid.
LOCK_DIR="$STATE_DIR/driver.lock"
acquire_lock() {
  if mkdir "$LOCK_DIR" 2>/dev/null; then
    echo $$ > "$LOCK_DIR/pid"
    return 0
  fi
  local oldpid
  oldpid="$(cat "$LOCK_DIR/pid" 2>/dev/null || true)"
  if [[ -n "$oldpid" ]] && kill -0 "$oldpid" 2>/dev/null; then
    echo "FATAL: another driver is already running (pid $oldpid). Refusing to start a second one." >&2
    echo "       Stop it first (touch $STOP_FILE, or kill $oldpid)." >&2
    exit 1
  fi
  echo "Removing stale lock left by pid ${oldpid:-unknown}."
  rm -rf "$LOCK_DIR"
  mkdir "$LOCK_DIR" && echo $$ > "$LOCK_DIR/pid"
}
acquire_lock

# On any exit (normal, Ctrl+C, kill), take down our direct children — the
# timeout/claude pipeline — so a killed driver doesn't leave an orphaned
# session running (the cause of the "two Claudes" incident), then drop the lock.
cleanup() {
  pkill -TERM -P $$ 2>/dev/null || true
  rm -rf "$LOCK_DIR"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

if [[ ! -f "$PROMPT_FILE" ]]; then
  echo "FATAL: prompt file not found at $PROMPT_FILE" >&2
  exit 1
fi

if [[ ! -f "$PROGRESS_FILE" ]]; then
  cp "$HERE/FLAKY_PROGRESS.template.md" "$PROGRESS_FILE"
  echo "Initialized progress file at $PROGRESS_FILE"
fi

# Pick a timeout command if one is available (`timeout` on Linux,
# `gtimeout` from coreutils on macOS). If neither exists, run without a cap.
TIMEOUT_BIN=""
if command -v timeout >/dev/null 2>&1; then
  TIMEOUT_BIN="timeout"
elif command -v gtimeout >/dev/null 2>&1; then
  TIMEOUT_BIN="gtimeout"
else
  echo "WARNING: no 'timeout'/'gtimeout' found; iterations will run without a time cap."
  echo "         (macOS: 'brew install coreutils' to get gtimeout.)"
fi

cd "$REPO_ROOT"

# A leftover STOP from a previous run shouldn't silently abort a fresh launch.
# STOP is a one-shot signal: clear any stale one here, then the loop only reacts
# to a STOP created while this run is in progress.
if [[ -f "$STOP_FILE" ]]; then
  rm -f "$STOP_FILE"
  echo "Cleared a stale STOP file from a previous run."
fi

echo "Driver starting in $REPO_ROOT (model=$MODEL, max_iters=$MAX_ITERS, timeout=${TIMEOUT_BIN:-none})"

for (( i=1; i<=MAX_ITERS; i++ )); do
  if [[ -f "$STOP_FILE" ]]; then
    echo "STOP file present ($STOP_FILE) — exiting loop."
    rm -f "$STOP_FILE"
    break
  fi

  ts="$(date +%Y%m%d-%H%M%S)"
  raw_log="$LOG_DIR/iter-$(printf '%03d' "$i")-$ts.jsonl"
  log="$LOG_DIR/iter-$(printf '%03d' "$i")-$ts.log"
  echo "==================================================================="
  echo "=== Iteration $i / $MAX_ITERS @ $ts"
  echo "=== Log: $log"
  echo "==================================================================="

  # Each iteration is a fresh session. --dangerously-skip-permissions is what
  # lets it run unattended; see README for a safer allowlist alternative.
  #
  # Headless `claude -p` with the default text output only prints at the very
  # end (it looks "stuck" while it works). To watch it live, STREAM=1 uses
  # --output-format stream-json (which emits an event per step) piped through a
  # small formatter. Needs node, which this repo has anyway. STREAM=0 falls back
  # to plain text. Raw output is always tee'd to $log regardless.
  cmd=(claude -p "$(cat "$PROMPT_FILE")"
       --model "$MODEL"
       --dangerously-skip-permissions)

  use_formatter=0
  if [[ "$STREAM" != "0" ]] && command -v node >/dev/null 2>&1; then
    cmd+=(--verbose --output-format stream-json)
    use_formatter=1
  fi

  # Build the full command (with the timeout wrapper if available) as an array,
  # then run it directly as the first stage of the pipeline. Running it directly
  # — rather than via a shell function — lets bash exec-replace the subshell, so
  # `ps` shows the real `timeout`/`claude` process instead of a confusing second
  # copy of this script.
  # -k 30: if claude ignores the TERM at ITER_TIMEOUT, SIGKILL it 30s later.
  if [[ -n "$TIMEOUT_BIN" ]]; then
    full=("$TIMEOUT_BIN" -k 30 "$ITER_TIMEOUT" "${cmd[@]}")
  else
    full=("${cmd[@]}")
  fi

  # </dev/null: headless claude must never block waiting on stdin.
  # Raw stream-json goes to $raw_log; the human-readable view goes to the
  # terminal AND $log, so `tail -f` on the .log is live and readable.
  if [[ "$use_formatter" -eq 1 ]]; then
    "${full[@]}" </dev/null 2>&1 | tee "$raw_log" | node "$HERE/format-stream.mjs" | tee "$log"
  else
    "${full[@]}" </dev/null 2>&1 | tee "$log"
  fi
  code=${PIPESTATUS[0]}

  if [[ $code -eq 124 ]]; then
    echo "Iteration $i timed out after ${ITER_TIMEOUT}s (killed)."
  elif [[ $code -ne 0 ]]; then
    echo "Iteration $i: claude exited $code. Backing off ${BACKOFF}s before next."
    sleep "$BACKOFF"
  fi
done

echo "Loop finished after up to $MAX_ITERS iterations. See $LOG_DIR and $PROGRESS_FILE."
