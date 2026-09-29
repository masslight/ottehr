// Counts, per chart category, the rows each run charted, including the categories `summary.json` does not
// score. A diff tool, not a score: no gold is consulted.
//
// PHI: reads `*.result.json`, which contains clinical text. Print counts and category names only, never a
// display string.
//
// Usage:
//   npx tsx tools/easy-chart-eval/ledger.ts <runDir> [<runDir>...]

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

/**
 * State keys holding chart rows. Listed explicitly so keys that are not rows (`noteText`, `disposition`,
 * `templatesApplied`) stay out.
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
  'skipped',
  'otherSteps',
] as const;

function tallyRun(dir: string): { totals: Record<string, number>; cases: number; missingKeys: string[] } {
  const totals: Record<string, number> = {};
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
      totals[key] = (totals[key] ?? 0) + rows.length;
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

const keys = LIST_KEYS.filter((k) => runs.some((r) => r.totals[k] !== undefined));
const pad = (s: string | number, n: number): string => String(s).padStart(n);

console.log('\nROWS per chart category, counted across all cases in the run.\n');

for (const run of runs) {
  console.log(`${run.name}  (${run.cases} cases)`);
  console.log(`  ${'category'.padEnd(18)}${pad('rows', 7)}`);
  for (const key of keys) {
    const t = run.totals[key];
    if (t === undefined) continue;
    console.log(`  ${key.padEnd(18)}${pad(t, 7)}`);
  }
  if (run.missingKeys.length > 0) console.log(`  (state carried no key for: ${run.missingKeys.join(', ')})`);
  console.log();
}

// Deltas against the first directory, which is the baseline.
if (runs.length > 1) {
  const [base, ...rest] = runs;
  for (const run of rest) {
    console.log(`DELTA  ${run.name}  vs  ${base.name}   (unchanged categories omitted)`);
    console.log(`  ${'category'.padEnd(18)}${pad('rows', 8)}`);
    for (const key of keys) {
      const d = (run.totals[key] ?? 0) - (base.totals[key] ?? 0);
      if (d === 0) continue;
      console.log(`  ${key.padEnd(18)}${pad(`${d > 0 ? '+' : ''}${d}`, 8)}`);
    }
    console.log();
  }
}
