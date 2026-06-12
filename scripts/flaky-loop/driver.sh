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
#   MODEL=...         model id (default claude-sonnet-4-6; claude-opus-4-8 and
#                     claude-fable-5 are stronger but pricier)
#   ITER_TIMEOUT=7200 hard cap (seconds) per iteration; killed if exceeded
#   BACKOFF=60        seconds to wait after a non-zero claude exit (rate limits etc.)
#   STREAM=1          live, readable streaming of each session's steps (0 = plain final output)
#
# Stop early at any time (takes effect within ~5s, abandoning the in-flight
# iteration; the next launch's git-status check recovers any half-done work):
#   touch scripts/flaky-loop/state/STOP
# Or just `kill <driver-pid>` / Ctrl+C — both shut down cleanly, kill the
# running session, and free the app ports. `kill -9` is never needed.
#
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$HERE/../.." && pwd)"
STATE_DIR="$HERE/state"
LOG_DIR="$HERE/logs"
PROMPT_FILE="$HERE/prompt.md"
PROGRESS_FILE="$STATE_DIR/FLAKY_PROGRESS.md"
STOP_FILE="$STATE_DIR/STOP"
# Test-run channel: the agent writes the command it wants run to RUN_REQUEST and
# exits; the driver runs it (no 10-min Bash-tool cap, no fragile in-session
# waiting) and leaves the outcome in RUN_RESULT for the next session to read.
RUN_REQUEST="$STATE_DIR/RUN_REQUEST"
RUN_RESULT="$STATE_DIR/RUN_RESULT"

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
    echo "       Stop it first: touch $STOP_FILE  (or: kill $oldpid). No kill -9 needed." >&2
    exit 1
  fi
  echo "Removing stale lock left by pid ${oldpid:-unknown}."
  rm -rf "$LOCK_DIR"
  mkdir "$LOCK_DIR" && echo $$ > "$LOCK_DIR/pid"
}
acquire_lock

# Free the e2e app ports — a safety net for dev servers orphaned by a previous
# iteration or run.
APP_PORTS=(3000 3002 4002)
free_ports() {
  command -v lsof >/dev/null 2>&1 || return 0
  local p pids
  for p in "${APP_PORTS[@]}"; do
    pids="$(lsof -ti :"$p" 2>/dev/null || true)"
    [[ -n "$pids" ]] && kill -TERM $pids 2>/dev/null || true
  done
}

# Kill leftover e2e dev servers by command signature. Port-killing alone is not
# enough: the zambda server runs under `tsx watch`, which RESPAWNS it; and once
# a run is `kill -9`'d the whole npm/turbo/tsx chain orphans (reparents) so it's
# unreachable by process tree. These patterns are specific to the e2e stack, so
# they don't touch the driver, the claude session, or the stream formatter.
# (Used between iterations and at startup — never while a wanted run is live.)
DEV_SERVER_PATTERNS=('start:iac' 'tsx watch' 'tsx scripts/run-e2e' 'playwright test')
kill_dev_servers() {
  local pat
  for pat in "${DEV_SERVER_PATTERNS[@]}"; do
    pkill -f "$pat" 2>/dev/null || true
  done
  free_ports
}

# Recursively kill every descendant of $1 with signal $2, deepest first. We can
# rely on neither flock nor process groups (the driver isn't a group leader when
# backgrounded), and `pkill -P` only reaches DIRECT children — so the claude
# under the pipeline subshell would survive. Walking the tree with `pgrep -P`
# and killing leaves first stops e2e servers before they can reparent/orphan.
kill_descendants() {
  local parent="$1" sig="$2" child
  for child in $(pgrep -P "$parent" 2>/dev/null); do
    kill_descendants "$child" "$sig"
    kill -"$sig" "$child" 2>/dev/null || true
  done
}

# Full teardown: kill the current iteration's process subtree (claude + the
# pipeline) AND any e2e dev servers it spawned. Used at driver exit (cleanup),
# where killing all descendants — including the watcher — is what we want.
terminate_children() {
  kill_descendants $$ TERM
  kill_dev_servers
}

# On any exit (normal, Ctrl+C, kill TERM), tear down the running session so a
# stopped driver never leaves an orphaned claude/e2e run behind, then drop the
# lock. Re-arm the trap to empty first so this can't re-enter.
cleanup() {
  trap '' EXIT INT TERM
  terminate_children
  sleep 1
  kill_descendants $$ KILL   # hard-kill any straggler that ignored TERM
  rm -rf "$LOCK_DIR"
}
trap cleanup EXIT
trap 'echo; echo "Interrupted — shutting down."; exit 130' INT
trap 'echo; echo "Terminated — shutting down."; exit 143' TERM

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

# Run the test command the agent requested this iteration (if any), in the
# driver itself. The agent CANNOT reliably wait on a 20-40 min run inside a
# one-shot `claude -p` session (it dies in the quiet gaps; the Bash tool also
# caps foreground commands at 10 min), so the driver — plain bash, no cap — does
# the waiting and leaves a distilled result for the next session to read.
run_requested_test() {
  [[ -f "$RUN_REQUEST" ]] || return 0
  local req; req="$(head -1 "$RUN_REQUEST")"
  rm -f "$RUN_REQUEST"

  # Safety: only ever run the e2e npm scripts, never arbitrary file contents.
  if [[ "$req" != npm\ run\ ehr:e2e* && "$req" != npm\ run\ intake:e2e* ]]; then
    { echo "command: $req"; echo "exit_code: -1"
      echo "error: refused — only 'npm run ehr:e2e*' / 'npm run intake:e2e*' allowed"; } > "$RUN_RESULT"
    echo ">>> Refused test request (not an allowed e2e script): $req"
    return 0
  fi

  local rts run_log rc
  rts="$(date +%Y%m%d-%H%M%S)"
  run_log="$LOG_DIR/run-$(printf '%03d' "$i")-$rts.log"
  echo ">>> Driver running requested test (can take 10-40 min): $req"
  echo ">>>   log: $run_log"
  if [[ -n "$TIMEOUT_BIN" ]]; then
    { "$TIMEOUT_BIN" -k 30 "$ITER_TIMEOUT" bash -c "$req" >"$run_log" 2>&1; } &
  else
    { bash -c "$req" >"$run_log" 2>&1; } &
  fi
  wait $! ; rc=$?
  kill_dev_servers

  # Distill to a small, signal-rich summary (the full log is huge and mostly
  # zambda server noise); the next session reads this instead of the raw log.
  {
    echo "command: $req"
    echo "exit_code: $rc"
    [[ $rc -eq 124 ]] && echo "note: TIMED OUT after ${ITER_TIMEOUT}s"
    echo "log: $run_log"
    echo "--- result lines (filtered) ---"
    grep -aE '✓|✘|✗|×|[0-9]+ (passed|failed|flaky|skipped)|Error:|TimeoutError|expect\(' "$run_log" \
      | grep -avE 'zambdas:start:iac|ehr-ui:|intake-ui:|Got auth0|Fetching auth0' \
      | tail -80
  } > "$RUN_RESULT"
  echo ">>> Test run finished (exit $rc). Summary -> $RUN_RESULT"
}

cd "$REPO_ROOT"

# A leftover STOP from a previous run shouldn't silently abort a fresh launch.
# STOP is a one-shot signal: clear any stale one here, then the loop only reacts
# to a STOP created while this run is in progress.
if [[ -f "$STOP_FILE" ]]; then
  rm -f "$STOP_FILE"
  echo "Cleared a stale STOP file from a previous run."
fi

# Clear any stale test-run channel files so the first session starts clean: a
# leftover RUN_REQUEST must not auto-run, and a stale RUN_RESULT must not mislead.
rm -f "$RUN_REQUEST" "$RUN_RESULT"

# Clear e2e dev servers orphaned by a previous run (e.g. one that ended in
# `kill -9`, which can't run cleanup). Start from a known-clean slate.
echo "Clearing any e2e dev servers left over from a previous run..."
kill_dev_servers

# Background watcher: if STOP appears mid-iteration, signal the driver to shut
# down promptly (cleanup() then tears down the running session). $$ inside this
# subshell is still the driver's pid.
( while [[ ! -f "$STOP_FILE" ]]; do sleep 5; done
  kill -TERM $$ 2>/dev/null ) &

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

  # Run the pipeline in the BACKGROUND and `wait` on it. A foreground external
  # command makes bash defer signal traps until it finishes — that's why a plain
  # `kill` of the driver used to do nothing until the iteration ended (forcing
  # kill -9, which orphaned the e2e servers). `wait` is interruptible, so STOP /
  # Ctrl+C / kill take effect within seconds and cleanup() runs.
  #
  # </dev/null: headless claude must never block on stdin. Raw stream-json goes
  # to $raw_log; the readable view goes to the terminal AND $log (so `tail -f`
  # on the .log is live and readable). pipefail surfaces a non-zero claude exit.
  if [[ "$use_formatter" -eq 1 ]]; then
    { "${full[@]}" </dev/null 2>&1 | tee "$raw_log" | node "$HERE/format-stream.mjs" | tee "$log"; } &
  else
    { "${full[@]}" </dev/null 2>&1 | tee "$log"; } &
  fi
  wait $! ; code=$?

  # Tear down any e2e dev servers between iterations so nothing (especially the
  # respawning zambda `tsx watch`) lingers into the next run.
  kill_dev_servers

  if [[ -f "$STOP_FILE" ]]; then
    continue   # let the top-of-loop check report and exit without a backoff wait
  fi

  # If the session asked for a test run, the driver executes it now (the agent
  # never runs e2e tests itself) and leaves the outcome for the next session.
  run_requested_test

  if [[ -f "$STOP_FILE" ]]; then
    continue
  fi

  if [[ $code -eq 124 ]]; then
    echo "Iteration $i timed out after ${ITER_TIMEOUT}s (killed)."
  elif [[ $code -ne 0 ]]; then
    echo "Iteration $i: claude exited $code. Backing off ${BACKOFF}s before next."
    sleep "$BACKOFF" & wait $!   # interruptible backoff (see note above)
  fi
done

echo "Loop finished after up to $MAX_ITERS iterations. See $LOG_DIR and $PROGRESS_FILE."
