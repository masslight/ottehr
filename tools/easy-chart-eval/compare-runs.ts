/**
 * compare-runs.ts — every scorer field for N runs, side by side.
 *
 * summary-table.ts prints one run in full; this prints several in the same shape so a prompt or
 * model change can be read off without picking rows by hand. Nothing is summarised away: both
 * scopes, every section with its context and unvoiced columns (the ones that decide the
 * denominators), every scalar, the free-text pairing, the counters, the disposition block and the
 * token/escalation totals.
 *
 * Reads runs from either project — ours stores the simulated chart under `state`, dabrams' under
 * `finalState` — and compares only the cases present in ALL of them, so a partial re-run cannot
 * silently shift a total.
 *
 * Usage:
 *   npx tsx tools/easy-chart-eval/compare-runs.ts <runDir> <runDir> [<runDir>...]
 *   npx tsx tools/easy-chart-eval/compare-runs.ts <a> <b> --scope plannerOnly
 */
import { existsSync, readdirSync, readFileSync } from 'fs';
import { basename, join } from 'path';

type Scope = 'plannerOnly' | 'final';
const SECTIONS = ['diagnoses', 'cpt', 'ros', 'exam', 'medsPrescribed', 'medsInHouse', 'immunizations'] as const;
const FREETEXT = [
  'historyOfPresentIllness',
  'additionalInformation',
  'medicalDecisionMaking',
  'rosFreeText',
  'mechanismOfInjury',
] as const;

interface Tally {
  sections: Record<string, Record<string, number>>;
  scalars: Record<string, number>;
  freeText: Record<string, { gold: number; pred: number; both: number }>;
  counters: Record<string, number>;
  usage: Record<string, number>;
}

const num = (v: unknown): number => (typeof v === 'number' ? v : 0);

function tally(runDir: string, ids: string[], scope: Scope): Tally {
  const t: Tally = { sections: {}, scalars: {}, freeText: {}, counters: {}, usage: {} };
  for (const s of SECTIONS)
    t.sections[s] = {
      goldInScope: 0,
      predicted: 0,
      matched: 0,
      contextGold: 0,
      contextCharted: 0,
      unvoicedGold: 0,
      unvoicedMatched: 0,
    };
  for (const f of FREETEXT) t.freeText[f] = { gold: 0, pred: 0, both: 0 };
  const bump = (k: string, v: number): void => void (t.scalars[k] = (t.scalars[k] ?? 0) + v);

  for (const id of ids) {
    const j = JSON.parse(readFileSync(join(runDir, `${id}.score.json`), 'utf8'));
    const sc = j.scopes[scope];
    for (const s of SECTIONS) for (const k of Object.keys(t.sections[s])) t.sections[s][k] += num(sc[s]?.[k]);

    if (sc.em?.gold) bump('em: gold cases', 1);
    if (sc.em?.predicted) bump('em: predicted', 1);
    bump('em: exact', sc.em?.match === true ? 1 : 0);
    bump('em: level', sc.em?.levelMatch === true ? 1 : 0);
    if (sc.primaryDx?.goldCode) bump('primaryDx: gold cases', 1);
    if (sc.primaryDx?.match !== null && sc.primaryDx?.match !== undefined) bump('primaryDx: both charted', 1);
    bump('primaryDx: matched', sc.primaryDx?.match === true ? 1 : 0);
    if (sc.primaryDx?.goldVoiced === true && sc.primaryDx?.match !== null) {
      bump('primaryDx: voiced denom', 1);
      bump('primaryDx: voiced matched', sc.primaryDx.match === true ? 1 : 0);
    }
    if (sc.primaryDx?.goldVoiced === false) bump('primaryDx: unvoicedGold', 1);
    bump('ros: polarityAgree', num(sc.ros?.polarityAgree));
    bump('exam: abnormalAgree', num(sc.exam?.abnormalAgree));
    for (const k of ['predicted', 'matched', 'contextCharted', 'unvoicedMatched', 'intentMatched'] as const) {
      bump(`medsCombined: ${k}`, num(sc.medsCombined?.[k]));
    }
    for (const k of ['legacyVoiced', 'intentVoiced', 'intentCovered'] as const)
      bump(`medsVoicing: ${k}`, num(sc.medsPrescribed?.[k]));

    for (const f of FREETEXT) {
      // The scorer records presence as `goldPresent` / `predictedPresent` (plus lengths); this is a
      // presence-only metric, so lengths are deliberately not aggregated.
      const ft = j.freeText?.[f];
      if (!ft) continue;
      if (ft.goldPresent) t.freeText[f].gold++;
      if (ft.predictedPresent) t.freeText[f].pred++;
      if (ft.goldPresent && ft.predictedPresent) t.freeText[f].both++;
    }
    // Some counters are per-case BOOLEANS (goldDisposition, goldDispositionVoiced, …). Count those as
    // cases; a number-only filter dropped them from the table without saying so.
    for (const [k, v] of Object.entries(j.counters ?? {})) {
      const n = typeof v === 'number' ? v : v === true ? 1 : v === false ? 0 : undefined;
      if (n !== undefined) t.counters[k] = (t.counters[k] ?? 0) + n;
    }
    for (const [k, v] of Object.entries(j.contextCharted ?? {}))
      if (typeof v === 'number') t.counters[`ctx: ${k}`] = (t.counters[`ctx: ${k}`] ?? 0) + v;
    const dt = j.dispositionTrigger;
    if (dt) {
      t.counters[`trigger: ${dt.fired ? (dt.modelProposed ? 'firedProposed' : 'firedDeclined') : 'notFired'}`] =
        (t.counters[`trigger: ${dt.fired ? (dt.modelProposed ? 'firedProposed' : 'firedDeclined') : 'notFired'}`] ??
          0) + 1;
    }
    // `usage` is keyed BY STAGE ({ planner: {...}, review: {...} }), not a list.
    for (const [stage, u] of Object.entries((j.usage ?? {}) as Record<string, Record<string, unknown>>)) {
      for (const k of ['inputTokens', 'outputTokens', 'thinkingTokens', 'cacheReadTokens', 'calls'] as const) {
        t.usage[`${stage} ${k}`] = (t.usage[`${stage} ${k}`] ?? 0) + num(u?.[k]);
      }
      const esc = u?.escalation as { primaryFailed?: boolean } | undefined;
      if (esc?.primaryFailed) t.usage[`${stage} primaryFailed`] = (t.usage[`${stage} primaryFailed`] ?? 0) + 1;
    }
  }
  return t;
}

function main(): void {
  const args = process.argv.slice(2);
  const si = args.indexOf('--scope');
  const scope = (si >= 0 ? args[si + 1] : 'final') as Scope;
  const dirs = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--scope' && existsSync(a));
  if (dirs.length < 2) {
    console.log('usage: compare-runs.ts <runDir> <runDir> [...] [--scope final|plannerOnly]');
    process.exit(1);
  }
  // Only the cases every run has, so a partial re-run cannot move a total.
  const idSets = dirs.map(
    (d) =>
      new Set(
        readdirSync(d)
          .filter((f) => f.endsWith('.score.json'))
          .map((f) => f.replace('.score.json', ''))
      )
  );
  const ids = [...idSets[0]].filter((id) => idSets.every((s) => s.has(id))).sort();
  const ts = dirs.map((d) => tally(d, ids, scope));

  const W = 12;
  const head = (label: string): string =>
    label.padEnd(34) +
    dirs
      .map((d) =>
        basename(d)
          .slice(-W + 1)
          .padStart(W)
      )
      .join('');
  const row = (label: string, vals: (number | string)[]): void =>
    console.log(label.padEnd(34) + vals.map((v) => String(v).padStart(W)).join(''));

  console.log('='.repeat(34 + W * dirs.length));
  console.log(`${ids.length} cases common to all runs   —   scope: ${scope}`);
  dirs.forEach((d, i) => console.log(`  [${i + 1}] ${d}`));
  console.log('='.repeat(34 + W * dirs.length));
  console.log(`\n1. SECTIONS`);
  console.log(head(''));
  for (const s of SECTIONS) {
    if (ts.every((t) => t.sections[s].goldInScope === 0 && t.sections[s].predicted === 0)) continue;
    console.log(`  ${s}`);
    for (const k of [
      'goldInScope',
      'predicted',
      'matched',
      'contextGold',
      'contextCharted',
      'unvoicedGold',
      'unvoicedMatched',
    ]) {
      if (ts.every((t) => t.sections[s][k] === 0)) continue;
      row(
        `    ${k}`,
        ts.map((t) => t.sections[s][k])
      );
    }
    row(
      '    precision',
      ts.map((t) => {
        const x = t.sections[s];
        const den = x.predicted - x.unvoicedMatched - x.contextCharted;
        return den > 0 ? (x.matched / den).toFixed(3) : '—';
      })
    );
    row(
      '    recall',
      ts.map((t) => (t.sections[s].goldInScope ? (t.sections[s].matched / t.sections[s].goldInScope).toFixed(3) : '—'))
    );
  }
  console.log(`\n2. SCALARS`);
  for (const k of Object.keys(ts[0].scalars))
    row(
      `  ${k}`,
      ts.map((t) => t.scalars[k] ?? 0)
    );
  console.log(`\n3. FREE TEXT (presence: gold / predicted / both)`);
  for (const f of FREETEXT) {
    if (ts.every((t) => t.freeText[f].gold === 0 && t.freeText[f].pred === 0)) continue;
    row(
      `  ${f}`,
      ts.map((t) => `${t.freeText[f].gold}/${t.freeText[f].pred}/${t.freeText[f].both}`)
    );
  }
  console.log(`\n4. COUNTERS`);
  const ck = [...new Set(ts.flatMap((t) => Object.keys(t.counters)))].sort();
  for (const k of ck)
    row(
      `  ${k}`,
      ts.map((t) => t.counters[k] ?? 0)
    );
  console.log(`\n5. TOKENS`);
  const uk = [...new Set(ts.flatMap((t) => Object.keys(t.usage)))].sort();
  for (const k of uk)
    row(
      `  ${k}`,
      ts.map((t) => t.usage[k] ?? 0)
    );
  console.log();
}

main();
