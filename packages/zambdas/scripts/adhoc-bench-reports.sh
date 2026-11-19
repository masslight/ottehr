#!/usr/bin/env bash
# Compares ad hoc report fetching (src/scripts/adhoc-bench-reports.ts, reports r1–r5) three ways:
#   ideal            hand-written minimal searches (reference), from this checkout
#   valerii-layers   the layers version's fetchAdHocEncounterRows, from a temporary worktree of $LAYERS_REF
#   otr3737-runner   this branch's fetch-plan runner (runFetchPlan), from this checkout
# For each range: a warm-up pass (not counted), then $PASSES measured passes. The order of the ways rotates from
# report to report, and each even pass runs every report's order reversed. Runs never overlap. After each range,
# exact server counts (src/scripts/adhoc-bench-counts.ts). READ-ONLY against Oystehr.
#
#   packages/zambdas/scripts/adhoc-bench-reports.sh <env> [ranges="90 60"] [reports="r1 r2 r3 r4 r5"]
#
# <env> is a file in config/.env (e.g. local); it is linked into the worktree, never copied.
set -euo pipefail

ENV_NAME=${1:?usage: adhoc-bench-reports.sh <env> [ranges] [reports]}
RANGES=${2:-90 60}
REPORTS=${3:-r1 r2 r3 r4 r5}
WAYS=${WAYS:-ideal valerii-layers otr3737-runner}
PASSES=${PASSES:-2}
RUN_TIMEOUT_S=${RUN_TIMEOUT_S:-900}
LAYERS_REF=${LAYERS_REF:-cb33c890b4}

HERE=$(cd "$(dirname "$0")" && pwd -P)
CORE=$(git -C "$HERE" rev-parse --show-toplevel)
LAYERS=$(mktemp -d "${TMPDIR:-/tmp}/adhoc-bench-layers.XXXXXX")
OUT=$(mktemp -d "${TMPDIR:-/tmp}/adhoc-bench-reports.XXXXXX")

cleanup() { git -C "$CORE" worktree remove --force "$LAYERS" >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "layers code: $(git -C "$CORE" log --format='%h %s' -1 "$LAYERS_REF")"
git -C "$CORE" worktree add --detach --quiet "$LAYERS" "$LAYERS_REF"
mkdir -p "$LAYERS/node_modules"
for entry in "$CORE"/node_modules/* "$CORE"/node_modules/.bin; do
  name=$(basename "$entry")
  if [ -L "$entry" ]; then cp -P "$entry" "$LAYERS/node_modules/$name"; else ln -s "$entry" "$LAYERS/node_modules/$name"; fi
done
for pkg in zambdas utils; do
  if [ -d "$CORE/packages/$pkg/node_modules" ]; then ln -s "$CORE/packages/$pkg/node_modules" "$LAYERS/packages/$pkg/node_modules"; fi
done
mkdir -p "$LAYERS/config/.env"
ln -sf "$CORE/config/.env/$ENV_NAME.json" "$LAYERS/config/.env/$ENV_NAME.json"
cp "$CORE/packages/zambdas/src/scripts/adhoc-bench-reports.ts" "$LAYERS/packages/zambdas/src/scripts/adhoc-bench-reports.ts"

echo "results print as each run ends; logs: $OUT"

kill_tree() { local p; for p in $(pgrep -P "$1" 2>/dev/null); do kill_tree "$p"; done; kill -TERM "$1" 2>/dev/null || true; }

run() { # <way> <report> <days> <start> <end> [name prefix]
  local tree=$CORE mode=studio
  case $1 in ideal) mode=ideal ;; valerii-layers) tree=$LAYERS mode=current ;; esac
  local name="${6:-}$2-$3d-$1"
  (cd "$tree/packages/zambdas" && exec env NODE_OPTIONS='--preserve-symlinks' npx tsx src/scripts/adhoc-bench-reports.ts \
    "$ENV_NAME" "$mode" "$2" "$4" "$5" "$OUT/$name.json") >"$OUT/$name.log" 2>&1 &
  local pid=$!
  ( sleep "$RUN_TIMEOUT_S"; echo "TIMEOUT after ${RUN_TIMEOUT_S}s" >>"$OUT/$name.log"; kill_tree "$pid" ) &
  local watchdog=$! rc=0
  wait "$pid" || rc=$?
  kill_tree "$watchdog" >/dev/null 2>&1; wait "$watchdog" 2>/dev/null || true
  if grep -q '^TIMEOUT' "$OUT/$name.log"; then
    echo "{\"error\":\"over ${RUN_TIMEOUT_S} s\"}" >"$OUT/$name.json"
  elif [ $rc -ne 0 ] || [ ! -s "$OUT/$name.json" ]; then
    echo "{\"error\":\"the run crashed, see $OUT/$name.log\"}" >"$OUT/$name.json"
  fi
  echo "  [$1] $(grep -h '\[bench-reports\]' "$OUT/$name.log" || echo "$2: crashed or timed out, see $OUT/$name.log")"
}

read -r -a ways <<<"$WAYS"
n=${#ways[@]}
i=0
for days in $RANGES; do
  # One range for all the runs of these days, so every way reads the same data.
  END=$(node -e 'console.log(new Date().toISOString())')
  START=$(node -e "console.log(new Date(Date.now() - $days * 86400000).toISOString())")
  echo "== $days days: $START .. $END"
  # Warm-up: the database keeps what it has just read in memory, so the first read of a range is slower.
  echo "  warm-up (not counted):"
  for report in $REPORTS; do
    for way in $WAYS; do run "$way" "$report" "$days" "$START" "$END" warmup-; done
  done
  first=$i
  for pass in $(seq 1 "$PASSES"); do
    echo "  measured pass $pass:"
    i=$first
    for report in $REPORTS; do
      order=""
      for k in $(seq 0 $((n - 1))); do order="$order ${ways[$(((i + k) % n))]}"; done
      if [ $((pass % 2)) = 0 ]; then order=$(echo $order | tr ' ' '\n' | tail -r | tr '\n' ' '); fi
      i=$((i + 1))
      echo "  $report order: $order"
      for way in $order; do run "$way" "$report" "$days" "$START" "$END" "p$pass-"; done
    done
  done
  echo "  exact counts:"
  (cd "$CORE/packages/zambdas" && NODE_OPTIONS='--preserve-symlinks' npx tsx src/scripts/adhoc-bench-counts.ts \
    "$ENV_NAME" "$START" "$END" "$OUT/counts-${days}d.json") >"$OUT/counts-${days}d.log" 2>&1 || echo "  counts crashed"
  grep -h '\[bench-counts\]' "$OUT/counts-${days}d.log" | sed 's/^/    /' || true
done

node "$HERE/adhoc-bench-summarize.js" "$OUT" "$RANGES" "$REPORTS" "$PASSES" "$WAYS" | tee "$OUT/summary.txt"
echo "logs and raw results: $OUT"
