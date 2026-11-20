#!/usr/bin/env bash
# Compares the encounters dataset fetch of the current code with the code before the layer redesign:
# time of each run (alternating old/new, so a warm database cache helps neither) and whether the rows are the
# same. READ-ONLY against Oystehr.
#
#   packages/zambdas/scripts/adhoc-bench-compare.sh <env> [days=60] [layers=codes,vitals,medications,labs,signing] [rounds=2]
#
# <env> is a file in config/.env (e.g. local). The old code is checked out in a temporary git worktree at the
# commit before "batch async-bulk fetch helpers, layer modules" (override with ADHOC_BENCH_BASE=<commit>).
set -euo pipefail

ENV_NAME=${1:?usage: adhoc-bench-compare.sh <env> [days] [layers] [rounds]}
DAYS=${2:-60}
LAYERS=${3:-codes,vitals,medications,labs,signing}
ROUNDS=${4:-2}

CORE=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
BASE=${ADHOC_BENCH_BASE:-$(git -C "$CORE" log --format=%H -1 --grep='batch async-bulk fetch helpers, layer modules')^}
OLD=$(mktemp -d "${TMPDIR:-/tmp}/adhoc-bench-old.XXXXXX")
OUT=$(mktemp -d "${TMPDIR:-/tmp}/adhoc-bench-out.XXXXXX")

cleanup() { git -C "$CORE" worktree remove --force "$OLD" >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "old code: $(git -C "$CORE" log --format='%h %s' -1 "$BASE")"
git -C "$CORE" worktree add --detach --quiet "$OLD" "$BASE"

# Dependencies from the main checkout. Workspace packages (relative links such as utils -> ../packages/utils)
# are copied as links, so in the worktree they point at the worktree's own (old) packages.
mkdir -p "$OLD/node_modules"
for entry in "$CORE"/node_modules/* "$CORE"/node_modules/.bin; do
  name=$(basename "$entry")
  if [ -L "$entry" ]; then cp -P "$entry" "$OLD/node_modules/$name"; else ln -s "$entry" "$OLD/node_modules/$name"; fi
done
for pkg in zambdas utils; do
  if [ -d "$CORE/packages/$pkg/node_modules" ]; then
    ln -s "$CORE/packages/$pkg/node_modules" "$OLD/packages/$pkg/node_modules"
  fi
done
mkdir -p "$OLD/config/.env"
for file in "$CORE"/config/.env/*.json; do
  if [ ! -e "$OLD/config/.env/$(basename "$file")" ]; then
    ln -s "$(cd "$(dirname "$file")" && pwd -P)/$(basename "$file")" "$OLD/config/.env/$(basename "$file")"
  fi
done
cp "$CORE/packages/zambdas/src/scripts/adhoc-bench.ts" "$OLD/packages/zambdas/src/scripts/adhoc-bench.ts"

# The same range for every run.
END=$(node -e 'console.log(new Date().toISOString())')
START=$(node -e "console.log(new Date(Date.now() - $DAYS * 86400000).toISOString())")
echo "range $START .. $END, layers: $LAYERS, rounds: $ROUNDS"
echo "results print when a run ends; to follow a run: tail -f $OUT/*.log"

# A run that fails (a dropped connection — "fetch failed" — fails the old code, which has no retry) is run
# again, up to 3 attempts; the failed attempts' logs are kept.
run() { # <tree> <label> <n>
  local attempt
  for attempt in 1 2 3; do
    if (cd "$1/packages/zambdas" && NODE_OPTIONS='--preserve-symlinks' npx tsx src/scripts/adhoc-bench.ts \
      "$ENV_NAME" "$START" "$END" "$LAYERS" "$OUT/$2-$3.json" >"$OUT/$2-$3.attempt$attempt.log" 2>&1); then
      echo "  $2 #$3: $(node -e "const r=require('$OUT/$2-$3.json'); console.log(r.ms + ' ms, ' + r.rows + ' rows, ' + r.networkRetries + ' network retries' + (r.overBudget ? ', OVER the 13-minute budget (the worker would have stopped it)' : ''))")"
      return
    fi
    # The report's 13-minute fetch budget ran out: that is the result, not a glitch to retry.
    if grep -q 'exceeded its time budget' "$OUT/$2-$3.attempt$attempt.log"; then
      echo "  $2 #$3: did not finish within the 13-minute report budget"
      echo '{"dnf":true}' >"$OUT/$2-$3.json"
      return
    fi
    echo "  $2 #$3 attempt $attempt failed: $(grep -m1 -E 'Error|FAILED' "$OUT/$2-$3.attempt$attempt.log" | cut -c1-200)"
  done
  echo "$2 run $3 failed 3 times, logs: $OUT/$2-$3.attempt*.log"
  exit 1
}

for ((i = 1; i <= ROUNDS; i++)); do
  if ((i % 2)); then run "$OLD" old "$i"; run "$CORE" new "$i"; else run "$CORE" new "$i"; run "$OLD" old "$i"; fi
done

node - "$OUT" "$ROUNDS" <<'EOF'
const [dir, rounds] = [process.argv[2], Number(process.argv[3])];
const load = (v) => Array.from({ length: rounds }, (_, i) => require(`${dir}/${v}-${i + 1}.json`));
const finished = (runs) => runs.filter((r) => !r.dnf);
const old = finished(load('old'));
const now = finished(load('new'));
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const show = (label, runs) =>
  runs.length ? `${median(runs.map((r) => r.ms))} ms` : 'did not finish within the 13-minute budget';
console.log(`\nmedian: old ${show('old', old)}, new ${show('new', now)}`);
if (old.length && now.length) {
  console.log(`speed-up: ${(median(old.map((r) => r.ms)) / median(now.map((r) => r.ms))).toFixed(1)}x`);
  console.log(`rows: old ${old[0].rows}, new ${now[0].rows}`);
  if (old[0].fingerprint === now[0].fingerprint) {
    console.log('rows: IDENTICAL');
  } else {
    const fields = Array.from(new Set([...Object.keys(old[0].fields), ...Object.keys(now[0].fields)])).sort();
    const differ = fields.filter((f) => old[0].fields[f] !== now[0].fields[f]);
    console.log(`rows: DIFFERENT in ${differ.length} column(s): ${differ.join(', ')}`);
  }
}
console.log(`logs and results: ${dir}`);
EOF
