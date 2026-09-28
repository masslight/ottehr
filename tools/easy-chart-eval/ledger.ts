// Counts, per chart category, what each run added and removed, split by planner and review, including the
// categories `summary.json` does not score. A diff tool, not a score: no gold is consulted.
//
// PHI: reads `*.result.json`, which contains clinical text. Print counts and category names only, never a
// display string.
//
// Usage:
//   npx tsx tools/easy-chart-eval/ledger.ts <runDir> [<runDir>...]

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

interface Sourced {
  source?: string;
  removed?: boolean;
  removedBy?: string;
}

/**
 * State keys holding chart rows that can be added or removed. Listed explicitly so keys that are not rows
 * (`noteText`, `disposition`, `templatesApplied`) stay out.
 */
const LIST_KEYS = [
  'diagnoses',
  'conditions',
  'allergies',
  'medications',
  'surgicalHistory',
  'hospitalizations',
  'examObservations',
  'rosObservations',
  'cptCodes',
  'emEvents',
  'procedures',
  'labsOrdered',
  'radiology',
  'nursingOrders',
  'instructions',
  'vitals',
  'providerNotes',
  'examComments',
  'pendingNoteEdits',
  'skipped',
  'otherSteps',
] as const;

interface Tally {
  addedPlanner: number;
  addedReview: number;
  removedPlanner: number;
  removedReview: number;
  live: number;
}

function tallyRun(dir: string): { totals: Record<string, Tally>; cases: number; missingKeys: string[] } {
  const totals: Record<string, Tally> = {};
  const missing = new Set<string>();
  let cases = 0;

  for (const name of readdirSync(dir)
    .filter((f) => f.endsWith('.result.json'))
    .sort()) {
    const parsed = JSON.parse(readFileSync(join(dir, name), 'utf8')) as { state?: Record<string, unknown> };
    const state = parsed.state;
    if (!state) continue;
    cases += 1;

    for (const key of LIST_KEYS) {
      const rows = state[key];
      if (!Array.isArray(rows)) {
        if (!(key in state)) missing.add(key);
        continue;
      }
      totals[key] ??= { addedPlanner: 0, addedReview: 0, removedPlanner: 0, removedReview: 0, live: 0 };
      const t = totals[key];
      for (const row of rows as Sourced[]) {
        // Rows without a `source` (e.g. provider notes, which are plain strings) count as planner-added, so
        // the category does not read as empty.
        if (row?.source === 'review') t.addedReview += 1;
        else t.addedPlanner += 1;
        if (row?.removed) {
          if (row.removedBy === 'review') t.removedReview += 1;
          else t.removedPlanner += 1;
        } else {
          t.live += 1;
        }
      }
    }
  }
  return { totals, cases, missingKeys: [...missing].sort() };
}

const dirs = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (dirs.length === 0) {
  console.error('usage: ledger.ts <runDir> [<runDir>...]');
  process.exit(1);
}

const runs = dirs.map((dir) => {
  if (!existsSync(dir)) throw new Error(`no such run directory: ${dir}`);
  return { name: basename(dir), ...tallyRun(dir) };
});

const keys = LIST_KEYS.filter((k) => runs.some((r) => r.totals[k]));
const pad = (s: string | number, n: number): string => String(s).padStart(n);

console.log('\nADDED / REMOVED per chart category — "+P/+R" = added by planner/review, "-P/-R" = removed by');
console.log('planner/review, "live" = still on the note at the end. Counts across all cases in the run.\n');

for (const run of runs) {
  console.log(`${run.name}  (${run.cases} cases)`);
  console.log(
    `  ${'category'.padEnd(18)}${pad('+P', 6)}${pad('+R', 6)}${pad('-P', 6)}${pad('-R', 6)}${pad('live', 7)}`
  );
  for (const key of keys) {
    const t = run.totals[key];
    if (!t) continue;
    console.log(
      `  ${key.padEnd(18)}${pad(t.addedPlanner, 6)}${pad(t.addedReview, 6)}${pad(t.removedPlanner, 6)}${pad(
        t.removedReview,
        6
      )}${pad(t.live, 7)}`
    );
  }
  if (run.missingKeys.length > 0) console.log(`  (state carried no key for: ${run.missingKeys.join(', ')})`);
  console.log();
}

// Deltas against the first directory, which is the baseline.
if (runs.length > 1) {
  const [base, ...rest] = runs;
  for (const run of rest) {
    console.log(`DELTA  ${run.name}  vs  ${base.name}   (blank = unchanged)`);
    console.log(
      `  ${'category'.padEnd(18)}${pad('+P', 7)}${pad('+R', 7)}${pad('-P', 7)}${pad('-R', 7)}${pad('live', 8)}`
    );
    for (const key of keys) {
      const a = base.totals[key] ?? { addedPlanner: 0, addedReview: 0, removedPlanner: 0, removedReview: 0, live: 0 };
      const b = run.totals[key] ?? { addedPlanner: 0, addedReview: 0, removedPlanner: 0, removedReview: 0, live: 0 };
      const d = (x: number, y: number): string => (y - x === 0 ? '' : `${y - x > 0 ? '+' : ''}${y - x}`);
      const cells = [
        d(a.addedPlanner, b.addedPlanner),
        d(a.addedReview, b.addedReview),
        d(a.removedPlanner, b.removedPlanner),
        d(a.removedReview, b.removedReview),
        d(a.live, b.live),
      ];
      if (cells.every((c) => c === '')) continue;
      console.log(
        `  ${key.padEnd(18)}${pad(cells[0], 7)}${pad(cells[1], 7)}${pad(cells[2], 7)}${pad(cells[3], 7)}${pad(
          cells[4],
          8
        )}`
      );
    }
    console.log();
  }
}
