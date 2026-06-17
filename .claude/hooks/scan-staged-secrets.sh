#!/usr/bin/env bash
# PreToolUse(Bash) hook: scan staged changes for secrets before a `git commit`.
#
# Behaviour (see .claude/settings.json):
#   - Only acts on commands that run `git commit`. Everything else is a no-op.
#   - Scans the staged files with TruffleHog (binary, or docker fallback).
#   - DENIES the commit if a verified secret is found.
#   - DENIES the commit if TruffleHog cannot be run at all (block-on-failure).
#   - Stays silent (exit 0, no output) when clean, so normal permission flow
#     and the user's approval prompts are preserved.
#
# A Claude hook cannot be bypassed with `git commit --no-verify` — it runs
# before the command executes, unlike git's own hooks.

set -u

# Pin to the same TruffleHog line CI uses (see .github/workflows/lint-and-build.yml).
TRUFFLEHOG_VERSION="3.82.13"
DOCKER_IMAGE="ghcr.io/trufflesecurity/trufflehog:${TRUFFLEHOG_VERSION}"

# Which TruffleHog result buckets block a commit. Default is strict on purpose
# (the point of this guard is to catch an agent's mistakes):
#   verified   - credential confirmed live via an API call
#   unknown    - verification attempted but indeterminate (e.g. network blocked,
#                which is the common case in the agent's restricted environment)
#   unverified - regex match that failed/has no verifier (e.g. private keys)
# CI uses --only-verified to avoid false positives at PR scale; for a local
# pre-commit guard we err toward over-blocking. Relax via the env var, e.g.
# OTTEHR_TRUFFLEHOG_RESULTS=verified,unknown  or  =verified.
TRUFFLEHOG_RESULTS="${OTTEHR_TRUFFLEHOG_RESULTS:-verified,unknown,unverified}"

# --- helpers ---------------------------------------------------------------

# Emit a PreToolUse "deny" decision and exit. Arg 1 is a human-readable reason.
deny() {
  local reason="$1"
  # Sanitise for embedding in a JSON string literal.
  reason="${reason//\\/\\\\}"
  reason="${reason//\"/\'}"
  reason="${reason//$'\n'/ }"
  reason="${reason//$'\t'/ }"
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"%s"}}\n' "$reason"
  exit 0
}

# Extract a JSON field from stdin payload. Prefers jq, falls back to python3.
json_field() {
  local field="$1" payload="$2"
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$payload" | jq -r "$field // empty" 2>/dev/null
  elif command -v python3 >/dev/null 2>&1; then
    printf '%s' "$payload" | python3 -c '
import json, sys
path = sys.argv[1].lstrip(".").split(".")
try:
    obj = json.load(sys.stdin)
    for p in path:
        obj = obj.get(p, "") if isinstance(obj, dict) else ""
    print(obj if isinstance(obj, str) else "")
except Exception:
    print("")
' "$field"
  fi
}

# --- read hook input -------------------------------------------------------

PAYLOAD="$(cat)"
COMMAND="$(json_field '.tool_input.command' "$PAYLOAD")"
CWD="$(json_field '.cwd' "$PAYLOAD")"
[ -n "$CWD" ] || CWD="$PWD"

# Only care about `git commit`. Be liberal about surrounding syntax
# (cd ... && git commit, flags, etc.), but ignore dry runs.
case "$COMMAND" in
  *"git commit"*) : ;;
  *) exit 0 ;;
esac
case "$COMMAND" in
  *"--dry-run"*) exit 0 ;;
esac

# --- locate repo and staged files -----------------------------------------

REPO_ROOT="$(git -C "$CWD" rev-parse --show-toplevel 2>/dev/null)"
[ -n "$REPO_ROOT" ] || exit 0  # not a git repo; let the command proceed/fail on its own

# Staged, non-deleted files (NUL-separated; paths relative to repo root).
mapfile -d '' -t STAGED < <(git -C "$REPO_ROOT" diff --cached --name-only --diff-filter=ACMR -z)
[ "${#STAGED[@]}" -gt 0 ] || exit 0  # nothing staged to scan

# --- run TruffleHog --------------------------------------------------------

TMP_OUT="$(mktemp)"
trap 'rm -f "$TMP_OUT"' EXIT
status=0

if command -v trufflehog >/dev/null 2>&1; then
  ( cd "$REPO_ROOT" && trufflehog filesystem "${STAGED[@]}" \
      --results="$TRUFFLEHOG_RESULTS" --fail --no-update ) >"$TMP_OUT" 2>&1
  status=$?
elif command -v docker >/dev/null 2>&1; then
  if docker run --rm -v "$REPO_ROOT":/repo -w /repo "$DOCKER_IMAGE" \
      filesystem "${STAGED[@]}" --results="$TRUFFLEHOG_RESULTS" --fail --no-update \
      >"$TMP_OUT" 2>&1; then
    status=0
  else
    status=$?
  fi
else
  deny "TruffleHog secret scan could not run: neither the trufflehog binary nor docker is available. Commit blocked (block-on-failure policy). Install trufflehog (see .claude/hooks/install-trufflehog.sh) and retry."
fi

# TruffleHog --fail exits 183 when results are found. Treat any non-zero exit
# as a block, since under block-on-failure a scanner error must not pass.
if [ "$status" -ne 0 ]; then
  findings="$(grep -iE 'Found (verified|unverified)|Detector Type|Raw result' "$TMP_OUT" | head -n 20)"
  [ -n "$findings" ] || findings="$(head -n 20 "$TMP_OUT")"
  deny "TruffleHog detected potential secrets in staged files OR failed to run (exit ${status}). Commit blocked. Remove the secret(s) and use a secrets manager / env vars instead. Scanner output: ${findings}"
fi

# Clean: stay silent so normal permission handling proceeds.
exit 0
