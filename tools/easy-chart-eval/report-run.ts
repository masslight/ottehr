/**
 * report-run.ts — write a REPORT.md next to a run, so a run carries its own numbers.
 *
 * Everything here comes from the run's own `*.score.json` files, i.e. the scorer's numbers verbatim.
 * That is deliberate: an earlier hand-rolled comparison used its own matching keys and produced
 * plausible-looking figures that disagreed with the scorer (ROS predicted 651 against 507, meds
 * matched 0 against 4) because it deduplicated differently and compared drug names exactly rather
 * than fuzzily. Anything not in the score files is therefore absent here rather than approximated.
 *
 * It also means this works unchanged on the other project's runs: the score-file shape is shared,
 * even though the simulated-chart field is named differently on each side.
 *
 * The three quantities the report is built around:
 *   gold in scope   — gold the judge marked as derivable from the dictation. The recall denominator.
 *                     Verified equal to the voiced-tagged count in every scored section (untagged is
 *                     zero), so "matched" IS "matched against voiced gold" — there is no second number.
 *   unvoiced gold   — gold the dictation does not support. Excluded both ways: not a miss, and a
 *                     prediction landing on one is not a false positive either.
 *   overcharted     — predicted minus everything that landed on gold of any kind. The false positives,
 *                     and the only bucket that costs precision.
 *
 * Usage:
 *   npx tsx tools/easy-chart-eval/report-run.ts <runDir> [<runDir>...]
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { basename, dirname, join } from 'path';

type Scope = 'plannerOnly' | 'final';
const SCOPES: Scope[] = ['plannerOnly', 'final'];
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
/** Sections whose gold is intake / prior-chart CONTEXT (no voicing tags) — see the note they carry. */
const CONTEXT_SECTIONS = new Set<string>(['vitals', 'allergies', 'conditions', 'surgicalHistory', 'hospitalizations']);
/** Sections the assistant no longer charts at all: orders, not chart medications. */
const OUT_OF_SCOPE_SECTIONS = new Set<string>(['medsInHouse', 'immunizations']);
const FREETEXT = [
  'historyOfPresentIllness',
  'additionalInformation',
  'medicalDecisionMaking',
  'rosFreeText',
  'mechanismOfInjury',
] as const;

const n = (v: unknown): number => (typeof v === 'number' ? v : 0);
const pct = (a: number, b: number): string => (b > 0 ? (a / b).toFixed(3) : '—');

/**
 * How a section's gold splits by voicing tag, read from the CASE files rather than the score files.
 *
 * The scorer reports `goldInScope`, which means "voiced OR untagged" — not the same thing, and
 * conflating them misreads whole sections: medsInHouse and immunizations carry no voicing tags at all,
 * so their entire gold is untagged, and medsPrescribed's in-scope count excludes the intent-voiced
 * items (class spoken, drug name not) that commitment coverage scores instead.
 */
interface GoldSplit {
  voiced: number;
  unvoiced: number;
  untagged: number;
  note?: string;
}

/**
 * What ground-predictions.ts judged about the items we charted that the gold does not contain.
 *
 * Present only when that pass has been run for this run directory; the report degrades to the
 * chart-only numbers without it, because the grounding pass costs LLM calls and a run is scored
 * deterministically without one.
 */
interface Grounding {
  cases: number;
  grounded: Record<string, number>;
  ungrounded: Record<string, number>;
}

interface Agg {
  cases: number;
  goldSplit: Record<string, GoldSplit>;
  grounding?: Grounding;
  sec: Record<string, Record<Scope, Record<string, number>>>;
  scalar: Record<string, Record<Scope, number>>;
  freeText: Record<string, { gold: number; pred: number; both: number }>;
  counters: Record<string, number>;
  usage: Record<string, number>;
}

/** The corpus sits beside the results directory in both projects. */
function casesDirFor(runDir: string): string | undefined {
  const c = join(dirname(dirname(runDir)), 'harvested-cases');
  return existsSync(c) ? c : undefined;
}

const tagOf = (i: unknown): boolean | undefined => (i as { voiced?: boolean })?.voiced;

/** Count voiced / unvoiced / untagged per section, applying the scorer's own pre-filters. */
function goldSplits(casesDir: string, ids: string[]): Record<string, GoldSplit> {
  const out: Record<string, GoldSplit> = {};
  const add = (sec: string, items: unknown[]): void => {
    out[sec] ??= { voiced: 0, unvoiced: 0, untagged: 0 };
    for (const it of items) {
      const t = tagOf(it);
      if (t === true) out[sec].voiced++;
      else if (t === false) out[sec].unvoiced++;
      else out[sec].untagged++;
    }
  };
  let nameVoiced = 0;
  let intentVoiced = 0;
  for (const id of ids) {
    const file = join(casesDir, `${id}.json`);
    if (!existsSync(file)) continue;
    const g = JSON.parse(readFileSync(file, 'utf8')).gold ?? {};
    // fromLabOrder diagnoses are context, dropped before voicing matters.
    add(
      'diagnoses',
      (g.assessment?.diagnoses ?? []).filter((d: { fromLabOrder?: boolean }) => !d.fromLabOrder)
    );
    add('cpt', g.billing?.cptCodes ?? []);
    // present !== true is an unchecked box or a free-text comment field, dropped the same way.
    add(
      'ros',
      (g.reviewOfSystems?.observations ?? []).filter((o: { present?: boolean }) => o.present === true)
    );
    add(
      'exam',
      (g.exam ?? []).filter((o: { present?: boolean }) => o.present === true)
    );
    add('medsPrescribed', g.medications?.prescribed ?? []);
    add('medsInHouse', g.medications?.inHouseAdministered ?? []);
    add('immunizations', g.medications?.immunizations ?? []);
    add(
      'vitals',
      (g.vitals ?? []).filter((v: { field?: string }) =>
        [
          'vital-temperature',
          'vital-heartbeat',
          'vital-respiration-rate',
          'vital-oxygen-sat',
          'vital-blood-pressure',
          'vital-weight',
          'vital-height',
        ].includes(v.field ?? '')
      )
    );
    add('allergies', g.allergies ?? []);
    add('conditions', g.medicalHistory ?? []);
    add('surgicalHistory', g.surgicalHistory ?? []);
    add('hospitalizations', g.hospitalizations ?? []);
    for (const m of g.medications?.prescribed ?? []) {
      const v = m as { voiced?: boolean; nameVoiced?: boolean };
      if (v.voiced === true && v.nameVoiced === false) intentVoiced++;
      else if (v.voiced === true) nameVoiced++;
    }
  }
  if (out.medsPrescribed) {
    out.medsPrescribed.note =
      `of the ${out.medsPrescribed.voiced} voiced, ${nameVoiced} had the drug NAME spoken — that is the ` +
      `recall denominator — and ${intentVoiced} were intent-voiced (class or commitment spoken, name not), ` +
      `scored by commitment coverage in the scalars instead`;
  }
  for (const k of OUT_OF_SCOPE_SECTIONS) {
    if (out[k]) {
      out[k].note =
        'OUT OF SCOPE for the assistant since 2026-09-14: in-house administrations and immunizations are ORDERS, ' +
        'not chart medications, and are not offered to the model — 0 predicted is the expected figure. Earlier runs ' +
        'scored name coincidences from the add-medication pool here, which is why they show matches.';
    }
  }
  for (const k of CONTEXT_SECTIONS) {
    if (out[k]) {
      out[k].note =
        'gold here is intake / prior-chart CONTEXT (nurse-entered vitals, reconciled history) and carries no voicing ' +
        'tags: recall is against everything on the chart, most of which the provider never dictated. Read PRECISION — ' +
        'of what the model charted, how much the chart agrees with.';
    }
  }
  return out;
}

function aggregate(runDir: string): Agg {
  const files = readdirSync(runDir)
    .filter((f) => f.endsWith('.score.json'))
    .sort();
  const ids = files.map((f) => f.replace('.score.json', ''));
  const casesDir = casesDirFor(runDir);
  const a: Agg = {
    cases: 0,
    goldSplit: casesDir ? goldSplits(casesDir, ids) : {},
    grounding: readGrounding(runDir),
    sec: {},
    scalar: {},
    freeText: {},
    counters: {},
    usage: {},
  };
  for (const s of SECTIONS) {
    a.sec[s] = { plannerOnly: {}, final: {} };
    for (const sc of SCOPES)
      for (const k of [
        'goldInScope',
        'unvoicedGold',
        'contextGold',
        'predicted',
        'matched',
        'unvoicedMatched',
        'contextCharted',
      ])
        a.sec[s][sc][k] = 0;
  }
  const bump = (k: string, sc: Scope, v: number): void => {
    a.scalar[k] ??= { plannerOnly: 0, final: 0 };
    a.scalar[k][sc] += v;
  };
  for (const f of files) {
    const j = JSON.parse(readFileSync(join(runDir, f), 'utf8'));
    a.cases++;
    for (const sc of SCOPES) {
      const d = j.scopes?.[sc];
      if (!d) continue;
      for (const s of SECTIONS) for (const k of Object.keys(a.sec[s][sc])) a.sec[s][sc][k] += n(d[s]?.[k]);
      bump('E&M: gold cases', sc, d.em?.gold ? 1 : 0);
      bump('E&M: predicted', sc, d.em?.predicted ? 1 : 0);
      bump('E&M: exact', sc, d.em?.match === true ? 1 : 0);
      bump('E&M: level', sc, d.em?.levelMatch === true ? 1 : 0);
      bump('primary dx: gold cases', sc, d.primaryDx?.goldCode ? 1 : 0);
      bump('primary dx: both charted', sc, d.primaryDx?.match !== null && d.primaryDx?.match !== undefined ? 1 : 0);
      bump('primary dx: matched', sc, d.primaryDx?.match === true ? 1 : 0);
      if (d.primaryDx?.goldVoiced === true && d.primaryDx?.match !== null && d.primaryDx?.match !== undefined) {
        bump('primary dx: voiced denominator', sc, 1);
        bump('primary dx: voiced matched', sc, d.primaryDx.match === true ? 1 : 0);
      }
      bump('primary dx: unvoiced gold', sc, d.primaryDx?.goldVoiced === false ? 1 : 0);
      bump('ROS: polarity agree', sc, n(d.ros?.polarityAgree));
      bump('exam: abnormal agree', sc, n(d.exam?.abnormalAgree));
      for (const k of ['predicted', 'matched', 'contextCharted', 'unvoicedMatched', 'intentMatched'])
        bump(`meds combined: ${k}`, sc, n(d.medsCombined?.[k]));
      for (const k of ['legacyVoiced', 'intentVoiced', 'intentCovered'])
        bump(`meds voicing: ${k}`, sc, n(d.medsPrescribed?.[k]));
    }
    for (const ft of FREETEXT) {
      a.freeText[ft] ??= { gold: 0, pred: 0, both: 0 };
      const x = j.freeText?.[ft];
      if (!x) continue;
      if (x.goldPresent) a.freeText[ft].gold++;
      if (x.predictedPresent) a.freeText[ft].pred++;
      if (x.goldPresent && x.predictedPresent) a.freeText[ft].both++;
    }
    for (const [k, v] of Object.entries(j.counters ?? {})) {
      const val = typeof v === 'number' ? v : v === true ? 1 : v === false ? 0 : undefined;
      if (val !== undefined) a.counters[k] = (a.counters[k] ?? 0) + val;
    }
    for (const [k, v] of Object.entries(j.contextCharted ?? {}))
      if (typeof v === 'number') a.counters[`context charted: ${k}`] = (a.counters[`context charted: ${k}`] ?? 0) + v;
    for (const [stage, u] of Object.entries((j.usage ?? {}) as Record<string, Record<string, unknown>>)) {
      for (const k of ['calls', 'inputTokens', 'outputTokens', 'thinkingTokens', 'cacheReadTokens'])
        a.usage[`${stage} ${k}`] = (a.usage[`${stage} ${k}`] ?? 0) + n(u?.[k]);
      if ((u?.escalation as { primaryFailed?: boolean })?.primaryFailed)
        a.usage[`${stage} primary-model failures`] = (a.usage[`${stage} primary-model failures`] ?? 0) + 1;
    }
  }
  return a;
}

/** Section key used by ground-predictions.ts; the three med sections share one judged pool. */
const GROUNDING_SECTION: Record<string, string> = {
  diagnoses: 'diagnoses',
  cpt: 'cpt',
  ros: 'ros',
  exam: 'exam',
  medsPrescribed: 'medications',
  medsInHouse: 'medications',
  immunizations: 'medications',
  vitals: 'vitals',
  allergies: 'allergies',
  conditions: 'conditions',
  surgicalHistory: 'surgicalHistory',
  hospitalizations: 'hospitalizations',
};

function readGrounding(runDir: string): Grounding | undefined {
  const files = readdirSync(runDir).filter((f) => f.endsWith('.grounding.json'));
  if (files.length === 0) return undefined;
  const g: Grounding = { cases: files.length, grounded: {}, ungrounded: {} };
  for (const f of files) {
    const j = JSON.parse(readFileSync(join(runDir, f), 'utf8')) as { items?: { section: string; grounded: boolean }[] };
    for (const it of j.items ?? []) {
      const bucket = it.grounded ? g.grounded : g.ungrounded;
      bucket[it.section] = (bucket[it.section] ?? 0) + 1;
    }
  }
  return g;
}

function render(runDir: string, a: Agg): string {
  const out: string[] = [];
  const over = (s: string, sc: Scope): number => {
    const x = a.sec[s][sc];
    return x.predicted - x.matched - x.unvoicedMatched - x.contextCharted;
  };
  out.push(
    `# ${basename(runDir)}`,
    '',
    `${a.cases} cases. All figures are the scorer's own, read from this run's \`*.score.json\`.`,
    ''
  );
  out.push(
    '**How to read it.** `gold in scope` is the gold the judge marked as derivable from the dictation —',
    'the recall denominator, and equal to the voiced-tagged count in every section here, so `matched` is',
    'already "matched against voiced gold". `unvoiced gold` is gold the dictation does not support: it is',
    'excluded from recall, and a prediction landing on one is excluded from precision instead of counting',
    'as a false positive. `overcharted` is what is left — charted, and nowhere in the gold at all.',
    '',
    '```',
    'recall      = matched / gold in scope',
    'precision   = matched / (predicted − on unvoiced gold − on context gold)',
    'overcharted = predicted − matched − on unvoiced gold − on context gold',
    '```',
    ''
  );
  out.push('## Sections', '');
  for (const s of SECTIONS) {
    const f = a.sec[s].final;
    if (f.goldInScope === 0 && f.predicted === 0) continue;
    out.push(`### ${s}`, '');
    const g = a.goldSplit[s];
    out.push(
      `scored against **${f.goldInScope}** gold items · unvoiced gold (excluded) **${f.unvoicedGold}** · context gold (excluded) **${f.contextGold}**`,
      ''
    );
    if (g) {
      out.push(
        `gold composition, from the case files: **voiced ${g.voiced}** · unvoiced ${g.unvoiced} · untagged ${g.untagged}`,
        ''
      );
      if (g.note) out.push(`> ${g.note}`, '');
    }
    out.push("| | planner | after review | review's contribution |", '|---|---:|---:|---:|');
    const row = (label: string, p: number, fi: number): void =>
      out.push(`| ${label} | ${p} | ${fi} | ${fi - p >= 0 ? '+' : ''}${fi - p} |`);
    row('predicted', a.sec[s].plannerOnly.predicted, f.predicted);
    row('matched (= matched voiced)', a.sec[s].plannerOnly.matched, f.matched);
    row('on unvoiced gold (forgiven)', a.sec[s].plannerOnly.unvoicedMatched, f.unvoicedMatched);
    if (f.contextGold) row('on context gold (forgiven)', a.sec[s].plannerOnly.contextCharted, f.contextCharted);
    row('**overcharted**', over(s, 'plannerOnly'), over(s, 'final'));
    const den = f.predicted - f.unvoicedMatched - f.contextCharted;
    out.push('', `recall **${pct(f.matched, f.goldInScope)}** · precision **${pct(f.matched, den)}**`, '');
    const gsec = a.grounding ? GROUNDING_SECTION[s] : undefined;
    const gOk = gsec ? a.grounding!.grounded[gsec] ?? 0 : 0;
    const gNo = gsec ? a.grounding!.ungrounded[gsec] ?? 0 : 0;
    // The three medication sections share one judged pool, so attributing its counts to each of them
    // would triple them. They are reported once, under the combined pool in the summary below.
    const sharesMedPool = s === 'medsPrescribed' || s === 'medsInHouse' || s === 'immunizations';
    if (gOk + gNo > 0 && !sharesMedPool) {
      out.push(
        `Re-assessed against the dictation: of ${gOk + gNo} overcharted items judged, **${gOk} are grounded** — ` +
          `the dictation supports them and the signed chart simply omits them — and **${gNo} are not**.`,
        '',
        `precision vs the dictation **${pct(f.matched + gOk, den)}** · recall vs the dictation **${pct(
          f.matched + gOk,
          f.goldInScope + gOk
        )}**`,
        ''
      );
    }
  }
  out.push(
    '> `medsPrescribed`, `medsInHouse` and `immunizations` share ONE pool of predicted medications, so their',
    '> `predicted` figures are the same number and their per-section `overcharted` counts overlap. The',
    '> combined pool is in the scalars below.',
    ''
  );
  if (a.grounding) {
    out.push('## Re-assessed against the dictation', '');
    out.push(
      'The gold is the chart the provider SIGNED, not everything that was said. `overcharted` therefore mixes',
      'two different things: items nobody said, and items the provider said but never ticked. The voicing tags',
      'cannot separate them — they only ever forgive a prediction landing on gold the provider DID chart, so',
      'anything absent from the chart entirely is charged to precision whether or not it was spoken.',
      '',
      `ground-predictions.ts puts the same question to the same judge about the other side, over ${a.grounding.cases} cases:`,
      'for each charted item the gold lacks, does the dictation support it?',
      '',
      '| section | matched | overcharted | grounded | ungrounded | precision vs chart | precision vs dictation |',
      '|---|---:|---:|---:|---:|---:|---:|'
    );
    let tm = 0;
    let tden = 0;
    let tg = 0;
    for (const s of SECTIONS) {
      // Only the sections the grounding pass judges; the context sections are not re-assessed.
      if (!GROUNDING_SECTION[s]) continue;
      const isMedPool = s === 'medsPrescribed' || s === 'medsInHouse' || s === 'immunizations';
      if (isMedPool && s !== 'medsPrescribed') continue;
      const f = a.sec[s].final;
      // The three medication sections share one predicted pool and one judged pool; reporting each
      // separately would count the same items three times.
      const matched = isMedPool ? a.scalar['meds combined: matched'].final : f.matched;
      const predicted = isMedPool ? a.scalar['meds combined: predicted'].final : f.predicted;
      const unv = isMedPool ? a.scalar['meds combined: unvoicedMatched'].final : f.unvoicedMatched;
      const ctx = isMedPool ? a.scalar['meds combined: contextCharted'].final : f.contextCharted;
      const den = predicted - unv - ctx;
      const gOk = a.grounding.grounded[GROUNDING_SECTION[s]] ?? 0;
      const gNo = a.grounding.ungrounded[GROUNDING_SECTION[s]] ?? 0;
      if (den <= 0 && gOk + gNo === 0) continue;
      tm += matched;
      tden += den;
      tg += gOk;
      const name = isMedPool ? 'medications (combined pool)' : s;
      out.push(
        `| ${name} | ${matched} | ${den - matched} | ${gOk} | ${gNo} | ${pct(matched, den)} | **${pct(
          matched + gOk,
          den
        )}** |`
      );
    }
    out.push(
      `| **all sections** | ${tm} | ${tden - tm} | ${tg} | | ${pct(tm, tden)} | **${pct(tm + tg, tden)}** |`,
      ''
    );
    out.push(
      '**Read the second recall with care.** Precision re-assesses cleanly: its denominator is what we charted, and',
      'the judge tells us how much of that the dictation supports. Recall does not, because its denominator is the',
      'gold, and grounding says nothing about items neither the provider nor the model charted. The per-section',
      '"recall vs the dictation" adds the grounded items to both sides of the fraction, which can only move it up —',
      'it is an upper bound on what recall would be against a complete gold, not a measurement of one.',
      ''
    );
  }

  out.push('## Scalars', '', "| | planner | after review | review's contribution |", '|---|---:|---:|---:|');
  for (const [k, v] of Object.entries(a.scalar))
    out.push(
      `| ${k} | ${v.plannerOnly} | ${v.final} | ${v.final - v.plannerOnly >= 0 ? '+' : ''}${v.final - v.plannerOnly} |`
    );
  out.push('');
  out.push('## Free text (presence only)', '', '| field | gold | predicted | both |', '|---|---:|---:|---:|');
  for (const [k, v] of Object.entries(a.freeText))
    if (v.gold || v.pred) out.push(`| ${k} | ${v.gold} | ${v.pred} | ${v.both} |`);
  out.push('');
  out.push('## Counters', '', '| | whole run |', '|---|---:|');
  for (const k of Object.keys(a.counters).sort()) out.push(`| ${k} | ${a.counters[k]} |`);
  out.push('');
  out.push('## Cost and reliability', '', '| | whole run |', '|---|---:|');
  for (const k of Object.keys(a.usage).sort()) out.push(`| ${k} | ${a.usage[k]} |`);
  out.push('');
  return out.join('\n');
}

function main(): void {
  const dirs = process.argv.slice(2).filter((d) => !d.startsWith('--'));
  if (dirs.length === 0) {
    console.log('usage: report-run.ts <runDir> [<runDir>...]');
    process.exit(1);
  }
  for (const d of dirs) {
    const a = aggregate(d);
    const path = join(d, 'REPORT.md');
    writeFileSync(path, render(d, a));
    console.log(`${basename(d)}: ${a.cases} cases -> ${path}`);
  }
}

main();
