#!/usr/bin/env bash
# Three typical reports (src/scripts/adhoc-bench-reports.ts), each fetched three ways — this version ("current"),
# hand-written minimal searches ("ideal") and Report Studio's runner ("studio") — over 60 days and a year. Prints, per
# report and range, the time, request count, errors and whether the result matches the ideal one, then where each
# way spent its time. READ-ONLY against Oystehr. Each range first runs a warm-up pass that is not counted
# (ADHOC_BENCH_WARMUP=0 skips it).
#
#   packages/zambdas/scripts/adhoc-bench-reports.sh <env> [ranges="60 365"] [reports="r1 r2 r3"]
#
# <env> is a file in config/.env (e.g. local). Report Studio runs from a temporary git worktree of
# ADHOC_BENCH_STUDIO (default dabrams/report-studio-task); the other two run from this checkout.
set -euo pipefail

ENV_NAME=${1:?usage: adhoc-bench-reports.sh <env> [ranges] [reports]}
RANGES=${2:-60 365}
REPORTS=${3:-r1 r2 r3}

CORE=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
STUDIO_REF=${ADHOC_BENCH_STUDIO:-dabrams/report-studio-task}
STUDIO=$(mktemp -d "${TMPDIR:-/tmp}/adhoc-bench-studio.XXXXXX")
OUT=$(mktemp -d "${TMPDIR:-/tmp}/adhoc-bench-reports.XXXXXX")

cleanup() { git -C "$CORE" worktree remove --force "$STUDIO" >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "studio code: $(git -C "$CORE" log --format='%h %s' -1 "$STUDIO_REF")"
git -C "$CORE" worktree add --detach --quiet "$STUDIO" "$STUDIO_REF"

# Dependencies from the main checkout; workspace links (utils -> ../packages/utils) are copied as links, so in the
# worktree they point at the worktree's own packages.
mkdir -p "$STUDIO/node_modules"
for entry in "$CORE"/node_modules/* "$CORE"/node_modules/.bin; do
  name=$(basename "$entry")
  if [ -L "$entry" ]; then cp -P "$entry" "$STUDIO/node_modules/$name"; else ln -s "$entry" "$STUDIO/node_modules/$name"; fi
done
for pkg in zambdas utils; do
  if [ -d "$CORE/packages/$pkg/node_modules" ]; then
    ln -s "$CORE/packages/$pkg/node_modules" "$STUDIO/packages/$pkg/node_modules"
  fi
done
mkdir -p "$STUDIO/config/.env"
for file in "$CORE"/config/.env/*.json; do
  if [ ! -e "$STUDIO/config/.env/$(basename "$file")" ]; then
    ln -s "$(cd "$(dirname "$file")" && pwd -P)/$(basename "$file")" "$STUDIO/config/.env/$(basename "$file")"
  fi
done
cp "$CORE/packages/zambdas/src/scripts/adhoc-bench-reports.ts" "$STUDIO/packages/zambdas/src/scripts/adhoc-bench-reports.ts"

echo "results print as each run ends; logs: $OUT"

run() { # <way> <report> <days> <start> <end> [name prefix]
  local tree="$CORE"
  [ "$1" = studio ] && tree="$STUDIO"
  local name="${6:-}$2-$3d-$1"
  (cd "$tree/packages/zambdas" && NODE_OPTIONS='--preserve-symlinks' npx tsx src/scripts/adhoc-bench-reports.ts \
    "$ENV_NAME" "$1" "$2" "$4" "$5" "$OUT/$name.json" >"$OUT/$name.log" 2>&1) ||
    echo "{\"error\":\"the run crashed, see $OUT/$name.log\"}" >"$OUT/$name.json"
  echo "  $(grep -h '\[bench-reports\]' "$OUT/$name.log" || echo "$1 $2: crashed, see $OUT/$name.log")"
}

i=0
for days in $RANGES; do
  # One range for all the runs of these days, so every way reads the same data.
  END=$(node -e 'console.log(new Date().toISOString())')
  START=$(node -e "console.log(new Date(Date.now() - $days * 86400000).toISOString())")
  echo "== $days days: $START .. $END"
  # Warm-up: every report and way once, not counted. The database keeps what it has just read in memory, so the
  # first read of a range is 1.6–3× slower; without this the first run of each range pays for everyone.
  if [ "${ADHOC_BENCH_WARMUP:-1}" != 0 ]; then
    echo "  warm-up (not counted):"
    for report in $REPORTS; do
      for way in ideal current studio; do run "$way" "$report" "$days" "$START" "$END" warmup-; done
    done
    echo "  measured:"
  fi
  for report in $REPORTS; do
    # The order rotates, so a warm database cache does not always help the same way.
    case $((i % 3)) in
      0) order="ideal current studio" ;;
      1) order="current studio ideal" ;;
      *) order="studio ideal current" ;;
    esac
    i=$((i + 1))
    for way in $order; do run "$way" "$report" "$days" "$START" "$END"; done
  done
done

node - "$OUT" "$RANGES" "$REPORTS" <<'EOF'
const fs = require('fs');
const [dir, ranges, reports] = [process.argv[2], process.argv[3].split(' '), process.argv[4].split(' ')];
const ways = ['ideal', 'current', 'studio'];
const names = { r1: 'visits per month per provider', r2: 'temperature by location', r3: 'diagnoses and CPT codes' };
const read = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return { error: 'no result' }; } };
const s = (ms) => (ms === undefined ? '-' : `${(ms / 1000).toFixed(1)} s`);

// Same result: exact, except the average temperature, which may differ by rounding (≤ 0.15 °F).
const norm = (r) => JSON.stringify(r, (k, v) => (k === 'avgF' && typeof v === 'number' ? Math.round(v * 5) / 5 : v));
const diff = (a, b) => {
  if (!a || !b) return 'no result to compare';
  if (norm(a) === norm(b)) return 'same';
  const keys = Array.from(new Set([...Object.keys(a), ...Object.keys(b)]));
  const bad = keys.filter((k) => norm(a[k]) !== norm(b[k]));
  return `DIFFERENT in ${bad.length} of ${keys.length}: ` +
    bad.slice(0, 3).map((k) => `${k} ideal=${JSON.stringify(b[k])} got=${JSON.stringify(a[k])}`).join('; ');
};

for (const days of ranges) {
  for (const report of reports) {
    const res = Object.fromEntries(ways.map((w) => [w, read(`${dir}/${report}-${days}d-${w}.json`)]));
    console.log(`\n### ${report} (${names[report]}), ${days} days`);
    for (const w of ways) {
      const r = res[w];
      const vs = w === 'ideal' ? 'reference' : r.error || res.ideal.error ? '-' : diff(r.result, res.ideal.result);
      console.log(`  ${w.padEnd(8)} ${s(r.ms).padStart(8)}  requests ${String(r.requests ?? '-').padStart(5)}  ` +
        `${r.error ? `ERROR ${r.error}` : `result: ${vs}`}${r.networkRetries ? `  (network retries ${r.networkRetries})` : ''}`);
    }
    for (const w of ways) {
      const groups = res[w].groups ?? [];
      if (!groups.length) continue;
      console.log(`  ${w} — where the time went:`);
      for (const g of groups) {
        const extra = [g.requests !== undefined ? `${g.requests} req` : '', g.resources !== undefined ? `${g.resources} res` : '']
          .filter(Boolean).join(', ');
        console.log(`    ${g.name.padEnd(28)} ${s(g.ms).padStart(8)}${extra ? `  (${extra})` : ''}`);
      }
    }
  }
}
console.log(`\nlogs and raw results: ${dir}`);
EOF
