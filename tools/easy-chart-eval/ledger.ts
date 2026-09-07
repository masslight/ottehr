// Every chart category a run touched, added AND removed, attributed to the planner or to review.
//
// WHY THIS EXISTS. `summary.json` scores seven sections — diagnoses, cpt, ros, exam, medsPrescribed,
// medsInHouse, immunizations — because those are the ones the harvested gold can be matched against.
// The executor writes a dozen more: allergies, past medical history, surgical history, hospitalizations,
// vitals, labs, radiology, procedures, nursing orders, patient instructions, provider notes, note text.
// Those are unscored, which is not the same as unimportant: a regression that silently stops charting
// allergies, or one where review starts removing medications, moves nothing in the summary at all.
//
// So this reads the simulated FINAL STATE out of each `<case>.result.json` and counts, per category,
// what was added and what was removed, split by `source` / `removedBy`. It is a DIFF TOOL, not a score:
// no gold is consulted, and a bigger number is not automatically better. Read it to answer "what
// changed between these two runs, anywhere in the chart".
//
// PHI: reads `*.result.json`, which DOES contain clinical text — so it prints counts and category names
// only, never a display string. Keep it that way; `report.ts` avoids these files entirely for the same
// reason and this tool is the deliberate exception.
//
// Usage:
//   npx tsx tools/easy-chart-eval/ledger.ts <runDir> [<runDir>...]

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

/** A state array whose entries may carry provenance and a removal marker. */
interface Sourced {
  source?: string;
  removed?: boolean;
  removedBy?: string;
}

/**
 * The state keys that hold LISTS of chart rows, i.e. everything that can be added or removed.
 *
 * Named explicitly rather than discovered, so a key the simulator gains shows up as missing here rather
 * than being silently averaged into nothing — and so the ones that are NOT lists (`noteText`,
 * `disposition`, `templatesApplied`) stay out, since "added or removed" does not describe them.
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
        // `source` is absent on categories the simulator never attributed (provider notes are plain
        // strings, for instance). Those count as planner-added rather than being dropped, because the
        // alternative is a column of zeroes that reads as "nothing was charted".
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

// The comparison view, when there is something to compare against. Baseline is the FIRST directory.
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
