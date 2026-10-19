/**
 * Prints every scorer field for several runs side by side, over the cases common to all of them.
 *
 * Usage:
 *   npx tsx tools/easy-chart-eval/compare-runs.ts <runDir> <runDir> [<runDir>...]
 */
import { existsSync, readdirSync, readFileSync } from 'fs';
import { basename, join } from 'path';

const SECTIONS = [
  'diagnoses',
  'cpt',
  'ros',
  'exam',
  'medsPrescribed',
  'medsInHouse',
  'immunizations',
  'vitals',
  'allergies',
  'conditions',
  'surgicalHistory',
  'hospitalizations',
] as const;
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

function tally(runDir: string, ids: string[]): Tally {
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
    for (const s of SECTIONS) for (const k of Object.keys(t.sections[s])) t.sections[s][k] += num(j[s]?.[k]);

    if (j.em?.gold) bump('em: gold cases', 1);
    if (j.em?.predicted) bump('em: predicted', 1);
    bump('em: exact', j.em?.match === true ? 1 : 0);
    bump('em: level', j.em?.levelMatch === true ? 1 : 0);
    if (j.primaryDx?.goldCode) bump('primaryDx: gold cases', 1);
    if (j.primaryDx?.match !== null && j.primaryDx?.match !== undefined) bump('primaryDx: both charted', 1);
    bump('primaryDx: matched', j.primaryDx?.match === true ? 1 : 0);
    if (j.primaryDx?.goldVoiced === true && j.primaryDx?.match !== null) {
      bump('primaryDx: voiced denom', 1);
      bump('primaryDx: voiced matched', j.primaryDx.match === true ? 1 : 0);
    }
    if (j.primaryDx?.goldVoiced === false) bump('primaryDx: unvoicedGold', 1);
    bump('ros: polarityAgree', num(j.ros?.polarityAgree));
    bump('exam: abnormalAgree', num(j.exam?.abnormalAgree));
    for (const k of ['predicted', 'matched', 'contextCharted', 'unvoicedMatched', 'intentMatched'] as const) {
      bump(`medsCombined: ${k}`, num(j.medsCombined?.[k]));
    }
    for (const k of ['legacyVoiced', 'intentVoiced', 'intentCovered'] as const)
      bump(`medsVoicing: ${k}`, num(j.medsPrescribed?.[k]));

    for (const f of FREETEXT) {
      // Presence only; the lengths the scorer also records are not aggregated.
      const ft = j.freeText?.[f];
      if (!ft) continue;
      if (ft.goldPresent) t.freeText[f].gold++;
      if (ft.predictedPresent) t.freeText[f].pred++;
      if (ft.goldPresent && ft.predictedPresent) t.freeText[f].both++;
    }
    // Some counters are per-case booleans (goldDisposition, goldDispositionVoiced, …); count those as cases.
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
    const u = (j.usage ?? {}) as Record<string, unknown>;
    for (const k of ['inputTokens', 'outputTokens', 'thinkingTokens', 'cacheReadTokens', 'calls'] as const) {
      t.usage[k] = (t.usage[k] ?? 0) + num(u[k]);
    }
    if ((u.escalation as { primaryFailed?: boolean } | undefined)?.primaryFailed) {
      t.usage.primaryFailed = (t.usage.primaryFailed ?? 0) + 1;
    }
  }
  return t;
}

function main(): void {
  const args = process.argv.slice(2);
  const dirs = args.filter((a) => !a.startsWith('--') && existsSync(a));
  if (dirs.length < 2) {
    console.log('usage: compare-runs.ts <runDir> <runDir> [...]');
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
  const ts = dirs.map((d) => tally(d, ids));

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
  console.log(`${ids.length} cases common to all runs`);
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
