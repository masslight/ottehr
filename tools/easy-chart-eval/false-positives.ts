/**
 * Lists what a run charted that the gold does not contain. Each predicted item lands in one bucket:
 *   matched, dupInGold (repeat of a matched code), onUnvoicedGold (gold judged not derivable from the
 *   dictation), onContextGold (already on the chart), or notInGold (the false positives).
 * The two "on...Gold" buckets are excluded from the precision denominator. Counts are cross-checked
 * against the run's .score.json files.
 *
 * Usage:
 *   npx tsx tools/easy-chart-eval/false-positives.ts <runDir> [<runDir>...]
 *   npx tsx tools/easy-chart-eval/false-positives.ts <runDir> --top 25
 *   npx tsx tools/easy-chart-eval/false-positives.ts <runDir> --section exam --top 40
 *   npx tsx tools/easy-chart-eval/false-positives.ts <runDir> --transcript-check
 *   npx tsx tools/easy-chart-eval/false-positives.ts <runDir> --missed --top 20
 *
 * --missed reports in-scope gold that was never charted (the recall misses).
 * --transcript-check: the gold is the signed chart, so a notInGold item may still have been said. It checks
 * whether the item's own words appear in the transcript, which shows the topic came up but not the polarity.
 */
import { existsSync, readdirSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { GoldData } from './gold-types';
import { isIntentVoiced, isUnvoiced, nameMatch, normCode, normName, rosBaseAndPolarity } from './score-harvested';

interface SimState {
  diagnoses: { display?: string; code?: string }[];
  cptCodes: { display?: string; code?: string }[];
  rosObservations: { baseKey: string; label?: string; finding?: string }[];
  examObservations: { field: string; label?: string }[];
  medications: { display?: string }[];
}

/**
 * Words with no clinical topic, which would ground anything. Polarity words are included because the
 * check asks whether the symptom was discussed; polarity is scored separately.
 */
const UNGROUNDING = new Set(
  (
    'denies denied reports reported normal abnormal none other unspecified obvious general bilateral left right ' +
    'and the with without for was are has have not any all clear intact present absent negative positive'
  ).split(' ')
);

const topicTokens = (label: string): string[] =>
  normName(label)
    .split(' ')
    .filter((t) => t.length >= 4 && !UNGROUNDING.has(t));

// Same prefix rule the scorer's tokensOverlap uses, so "fever" grounds "fevers" without a stemmer.
const inTranscript = (tokens: string[], transcriptTokens: Set<string>): boolean =>
  tokens.some((t) => {
    if (transcriptTokens.has(t)) return true;
    for (const w of transcriptTokens) {
      const [short, long] = t.length <= w.length ? [t, w] : [w, t];
      if (short.length >= 4 && long.startsWith(short)) return true;
    }
    return false;
  });

type Bucket = 'matched' | 'dupInGold' | 'onUnvoicedGold' | 'onContextGold' | 'notInGold';
/** Gold-side tally for --missed (the recall direction). */
interface MissTally {
  goldInScope: number;
  /** Gold items covered, each counted once, as the scorer's `matched` counts them. */
  matched: number;
  missed: number;
  /** missed gold, by label, so the systematic gaps are visible. */
  gaps: Map<string, number>;
}

const emptyMiss = (): MissTally => ({ goldInScope: 0, matched: 0, missed: 0, gaps: new Map() });

function foldMisses(miss: MissTally, gold: { key: string; label: string }[], predicted: Set<string>): void {
  // Keyed, so a gold code listed twice counts once, like the scorer's matched set.
  const byKey = new Map(gold.map((g) => [g.key, g.label]));
  for (const [key, label] of byKey) {
    miss.goldInScope++;
    if (predicted.has(key)) miss.matched++;
    else {
      miss.missed++;
      miss.gaps.set(label, (miss.gaps.get(label) ?? 0) + 1);
    }
  }
}

interface SectionTally {
  predicted: number;
  matched: number;
  /**
   * Repeat prediction of an already-matched gold code. Not wrong, but it costs precision because the
   * scorer's numerator is a set of codes while its denominator counts every prediction.
   */
  dupInGold: number;
  onUnvoicedGold: number;
  onContextGold: number;
  notInGold: number;
  /** notInGold items, by label, so the frequent offenders are visible. */
  offenders: Map<string, number>;
  /** --transcript-check: notInGold items whose own words do / do not appear in the dictation. */
  grounded: number;
  ungrounded: number;
}

const emptyTally = (): SectionTally => ({
  predicted: 0,
  matched: 0,
  dupInGold: 0,
  onUnvoicedGold: 0,
  onContextGold: 0,
  notInGold: 0,
  offenders: new Map(),
  grounded: 0,
  ungrounded: 0,
});

function record(tally: SectionTally, bucket: Bucket, label: string, transcript?: Set<string>): void {
  tally.predicted++;
  tally[bucket]++;
  if (bucket !== 'notInGold') return;
  tally.offenders.set(label, (tally.offenders.get(label) ?? 0) + 1);
  if (!transcript) return;
  if (inTranscript(topicTokens(label), transcript)) tally.grounded++;
  else tally.ungrounded++;
}

function tallyCase(
  gold: GoldData,
  state: SimState,
  tallies: Record<string, SectionTally>,
  transcript?: Set<string>,
  misses?: Record<string, MissTally>
): void {
  // Diagnoses: keyed on the normalized ICD code; lab-order dx are the context bucket.
  const dxScorable = (gold.assessment?.diagnoses ?? []).filter((d) => !d.fromLabOrder);
  const dxInScope = new Set(dxScorable.filter((d) => !isUnvoiced(d)).map((d) => d.codeNormalized));
  const dxUnvoiced = new Set(dxScorable.filter(isUnvoiced).map((d) => d.codeNormalized));
  const dxContext = new Set(
    (gold.assessment?.diagnoses ?? []).filter((d) => d.fromLabOrder).map((d) => d.codeNormalized)
  );
  // Mirrors the scorer: context is tested before in-scope gold, and a gold code is matched once
  // however many times it was predicted.
  const dxAlreadyMatched = new Set<string>();
  for (const p of state.diagnoses ?? []) {
    const code = normCode(p.code);
    const label = `${code || '(no code)'} — ${p.display ?? ''}`;
    // A predicted dx with no code cannot match anything; the scorer counts it as predictedNoCode.
    if (!code) record(tallies.diagnoses, 'notInGold', `(no code) — ${p.display ?? ''}`);
    else if (dxContext.has(code)) record(tallies.diagnoses, 'onContextGold', label);
    else if (dxInScope.has(code)) {
      record(tallies.diagnoses, dxAlreadyMatched.has(code) ? 'dupInGold' : 'matched', label);
      dxAlreadyMatched.add(code);
    } else if (dxUnvoiced.has(code)) record(tallies.diagnoses, 'onUnvoicedGold', label);
    else record(tallies.diagnoses, 'notInGold', label, transcript);
  }

  if (misses) {
    foldMisses(
      misses.diagnoses,
      dxScorable
        .filter((d) => !isUnvoiced(d))
        .map((d) => ({ key: d.codeNormalized, label: `${d.codeNormalized} — ${d.display}` })),
      new Set((state.diagnoses ?? []).map((p) => normCode(p.code)).filter(Boolean))
    );
  }

  // CPT
  const cptInScope = new Set((gold.billing?.cptCodes ?? []).filter((c) => !isUnvoiced(c)).map((c) => c.codeNormalized));
  const cptUnvoiced = new Set((gold.billing?.cptCodes ?? []).filter(isUnvoiced).map((c) => c.codeNormalized));
  // Like the scorer, predictions are a per-case set of codes (codeless dropped), so a repeated CPT counts once.
  const predCpt = new Map<string, string>();
  for (const p of state.cptCodes ?? []) {
    const code = normCode(p.code);
    if (code) predCpt.set(code, `${code} — ${p.display ?? ''}`);
  }
  for (const [code, label] of predCpt) {
    if (cptInScope.has(code)) record(tallies.cpt, 'matched', label);
    else if (cptUnvoiced.has(code)) record(tallies.cpt, 'onUnvoicedGold', label);
    else record(tallies.cpt, 'notInGold', label);
  }

  if (misses) {
    foldMisses(
      misses.cpt,
      (gold.billing?.cptCodes ?? [])
        .filter((c) => !isUnvoiced(c))
        .map((c) => ({ key: c.codeNormalized, label: `${c.codeNormalized} — ${c.display}` })),
      new Set(predCpt.keys())
    );
  }

  // ROS: keyed on the base field, polarity stripped (it is scored separately).
  const rosInScope = new Set<string>();
  const rosUnvoiced = new Set<string>();
  for (const o of gold.reviewOfSystems?.observations ?? []) {
    if (o.present !== true) continue;
    const { base } = rosBaseAndPolarity(o.field);
    if (isUnvoiced(o)) rosUnvoiced.add(base);
    else rosInScope.add(base);
  }
  // The scorer keys the predicted side by baseKey in a Map, so a duplicate base counts once.
  const predRos = new Map<string, string>();
  for (const o of state.rosObservations ?? []) predRos.set(o.baseKey, o.label ?? o.baseKey);
  for (const [base, label] of predRos) {
    if (rosInScope.has(base)) record(tallies.ros, 'matched', label);
    else if (rosUnvoiced.has(base)) record(tallies.ros, 'onUnvoicedGold', label);
    else record(tallies.ros, 'notInGold', `${label}  [${base}]`, transcript);
  }

  if (misses) {
    foldMisses(
      misses.ros,
      (gold.reviewOfSystems?.observations ?? [])
        .filter((o) => o.present === true && !isUnvoiced(o))
        .map((o) => ({ key: rosBaseAndPolarity(o.field).base, label: o.label ?? o.field })),
      new Set(predRos.keys())
    );
  }

  // Exam: keyed on the observation field. Like the scorer, a field charted twice counts once.
  const examInGold = new Set<string>();
  const examUnvoiced = new Set<string>();
  for (const o of gold.exam ?? []) {
    if (o.present !== true) continue;
    if (isUnvoiced(o)) examUnvoiced.add(o.field);
    else examInGold.add(o.field);
  }
  const predExam = new Map<string, string>();
  for (const p of state.examObservations ?? []) if (!predExam.has(p.field)) predExam.set(p.field, p.label ?? p.field);
  for (const [field, label] of predExam) {
    if (examInGold.has(field)) record(tallies.exam, 'matched', label);
    else if (examUnvoiced.has(field)) record(tallies.exam, 'onUnvoicedGold', label);
    else record(tallies.exam, 'notInGold', `${label}  [${field}]`, transcript);
  }

  if (misses) {
    foldMisses(
      misses.exam,
      (gold.exam ?? [])
        .filter((o) => o.present === true && !isUnvoiced(o))
        .map((o) => ({ key: o.field, label: o.label ?? o.field })),
      new Set(predExam.keys())
    );
  }

  // Medications: one predicted pool shared by prescribed, in-house and immunizations, matched greedily
  // in the scorer's order so a predicted item is consumed at most once.
  const pool = (state.medications ?? []).map((m) => ({ display: m.display ?? '', used: false }));
  const consume = (names: (string | undefined)[], bucket: Bucket): void => {
    for (const gn of names) {
      const hit = pool.find((p) => !p.used && nameMatch(p.display, gn));
      if (!hit) continue;
      hit.used = true;
      record(tallies.meds, bucket, hit.display);
    }
  };
  const prescribed = gold.medications?.prescribed ?? [];
  consume(
    prescribed.filter((m) => !isUnvoiced(m) && !isIntentVoiced(m)).map((m) => m.name),
    'matched'
  );
  consume(
    (gold.medications?.inHouseAdministered ?? []).map((m) => m.name),
    'matched'
  );
  consume(
    (gold.medications?.immunizations ?? []).map((m) => m.name),
    'matched'
  );
  // Intent-voiced (the class was spoken, not the drug name) leaves the denominator like context.
  consume(
    prescribed.filter(isIntentVoiced).map((m) => m.name),
    'onContextGold'
  );
  consume(
    prescribed.filter(isUnvoiced).map((m) => m.name),
    'onUnvoicedGold'
  );
  consume(
    (gold.medications?.currentReconciled ?? []).map((m) => m.name),
    'onContextGold'
  );
  for (const p of pool) if (!p.used) record(tallies.meds, 'notInGold', p.display);
  if (misses) {
    // Fresh greedy pass over the gold meds that carry recall: scorable prescribed, in-house, immunizations.
    const fresh = (state.medications ?? []).map((m) => ({ display: m.display ?? '', used: false }));
    const goldNames = [
      ...prescribed.filter((m) => !isUnvoiced(m) && !isIntentVoiced(m)).map((m) => m.name),
      ...(gold.medications?.inHouseAdministered ?? []).map((m) => m.name),
      ...(gold.medications?.immunizations ?? []).map((m) => m.name),
    ];
    for (const gn of goldNames) {
      misses.meds.goldInScope++;
      const hit = fresh.find((f) => !f.used && nameMatch(f.display, gn));
      if (hit) {
        hit.used = true;
        misses.meds.matched++;
      } else {
        misses.meds.missed++;
        const label = gn ?? '(unnamed)';
        misses.meds.gaps.set(label, (misses.meds.gaps.get(label) ?? 0) + 1);
      }
    }
  }
}

/** Cross-check against the run's own score files, so a drifted key function cannot pass silently. */
function crossCheck(runDir: string, tallies: Record<string, SectionTally>): string[] {
  const problems: string[] = [];
  const totals: Record<string, { predicted: number; matched: number; unvoiced: number }> = {};
  for (const f of readdirSync(runDir).filter((n) => n.endsWith('.score.json'))) {
    const score = JSON.parse(readFileSync(join(runDir, f), 'utf8'));
    for (const [name, key] of [
      ['diagnoses', 'diagnoses'],
      ['cpt', 'cpt'],
      ['ros', 'ros'],
      ['exam', 'exam'],
      ['meds', 'medsCombined'],
    ] as const) {
      const s = score[key];
      totals[name] ??= { predicted: 0, matched: 0, unvoiced: 0 };
      totals[name].predicted += s?.predicted ?? 0;
      totals[name].matched += s?.matched ?? 0;
      totals[name].unvoiced += s?.unvoicedMatched ?? 0;
    }
  }
  for (const [name, t] of Object.entries(totals)) {
    const mine = tallies[name];
    if (mine.predicted !== t.predicted) problems.push(`${name}: predicted ${mine.predicted} vs score ${t.predicted}`);
    if (mine.matched !== t.matched) problems.push(`${name}: matched ${mine.matched} vs score ${t.matched}`);
    if (mine.onUnvoicedGold !== t.unvoiced)
      problems.push(`${name}: onUnvoicedGold ${mine.onUnvoicedGold} vs score ${t.unvoiced}`);
  }
  return problems;
}

function casesDirFor(runDir: string): string {
  // <project>/…/harvested-results/<run>  ->  <project>/…/harvested-cases
  const candidate = join(dirname(dirname(runDir)), 'harvested-cases');
  if (existsSync(candidate)) return candidate;
  throw new Error(`no harvested-cases dir beside ${runDir}`);
}

function main(): void {
  const args = process.argv.slice(2);
  const valueOf = (n: string): string | undefined => {
    const i = args.indexOf(`--${n}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const top = Number(valueOf('top') ?? 12);
  const onlySection = valueOf('section');
  const transcriptCheck = args.includes('--transcript-check');
  const wantMisses = args.includes('--missed');
  const runDirs = args.filter((a) =>
    !a.startsWith('--') && !args.includes(`--${a}`) === false ? false : !a.startsWith('--')
  );
  const dirs = runDirs.filter((a) => existsSync(a));

  if (dirs.length === 0) {
    console.log(
      'usage: false-positives.ts <runDir> [<runDir>...] [--top N] [--section X] [--transcript-check] [--missed]'
    );
    process.exit(1);
  }

  const SECTIONS = ['diagnoses', 'cpt', 'ros', 'exam', 'meds'];
  for (const runDir of dirs) {
    const casesDir = casesDirFor(runDir);
    const tallies: Record<string, SectionTally> = Object.fromEntries(SECTIONS.map((s) => [s, emptyTally()]));
    const misses: Record<string, MissTally> | undefined = wantMisses
      ? Object.fromEntries(SECTIONS.map((s) => [s, emptyMiss()]))
      : undefined;
    let n = 0;
    for (const f of readdirSync(runDir)
      .filter((x) => x.endsWith('.result.json'))
      .sort()) {
      const id = f.replace('.result.json', '');
      const result = JSON.parse(readFileSync(join(runDir, f), 'utf8'));
      const state = (result.state ?? result.finalState) as SimState | undefined;
      if (!state) continue;
      const file = JSON.parse(readFileSync(join(casesDir, `${id}.json`), 'utf8')) as {
        gold: GoldData;
        transcript?: string;
      };
      const transcript = transcriptCheck
        ? new Set(
            normName(file.transcript ?? '')
              .split(' ')
              .filter(Boolean)
          )
        : undefined;
      tallyCase(file.gold, state, tallies, transcript, misses);
      n++;
    }

    console.log('='.repeat(96));
    console.log(`${runDir}   —   ${n} cases`);
    console.log('='.repeat(96));
    const problems = crossCheck(runDir, tallies);
    if (problems.length) {
      console.log('\n!! DOES NOT RECONCILE WITH .score.json — treat the numbers below as suspect:');
      for (const p of problems) console.log(`   ${p}`);
    }

    const pad = (s: string | number, w: number): string => String(s).padStart(w);
    console.log(
      `\n${'section'.padEnd(12)}${pad('pred', 7)}${pad('matched', 9)}${pad('dup', 6)}${pad('onUnv', 7)}${pad(
        'onCtx',
        7
      )}${pad('NOT IN GOLD', 13)}${pad('%FP', 7)}`
    );
    for (const s of SECTIONS) {
      const t = tallies[s];
      const pct = t.predicted ? `${Math.round((100 * t.notInGold) / t.predicted)}%` : '—';
      console.log(
        `${s.padEnd(12)}${pad(t.predicted, 7)}${pad(t.matched, 9)}${pad(t.dupInGold, 6)}${pad(
          t.onUnvoicedGold,
          7
        )}${pad(t.onContextGold, 7)}${pad(t.notInGold, 13)}${pad(pct, 7)}`
      );
    }
    const all = SECTIONS.reduce(
      (acc, s) => {
        acc.predicted += tallies[s].predicted;
        acc.notInGold += tallies[s].notInGold;
        return acc;
      },
      { predicted: 0, notInGold: 0 }
    );
    console.log(
      `${'TOTAL'.padEnd(12)}${pad(all.predicted, 7)}${pad('', 9)}${pad('', 6)}${pad('', 7)}${pad('', 7)}${pad(
        all.notInGold,
        13
      )}${pad(`${Math.round((100 * all.notInGold) / all.predicted)}%`, 7)}`
    );

    if (misses) {
      console.log(
        `\n${'section'.padEnd(12)}${pad('goldInScope', 13)}${pad('matched', 9)}${pad('NEVER CHARTED', 15)}${pad(
          '%miss',
          7
        )}`
      );
      for (const s of SECTIONS) {
        const m = misses[s];
        if (m.goldInScope === 0) continue;
        console.log(
          `${s.padEnd(12)}${pad(m.goldInScope, 13)}${pad(m.matched, 9)}${pad(m.missed, 15)}${pad(
            `${Math.round((100 * m.missed) / m.goldInScope)}%`,
            7
          )}`
        );
      }
      for (const s of SECTIONS) {
        if (onlySection && s !== onlySection) continue;
        const m = misses[s];
        if (m.missed === 0 || top === 0) continue;
        const ranked = [...m.gaps.entries()].sort((a, b) => b[1] - a[1]);
        console.log(
          `\n--- ${s}: in gold, in scope, NEVER charted — ${m.missed} items, ${ranked.length} distinct (top ${Math.min(
            top,
            ranked.length
          )}) ---`
        );
        for (const [label, count] of ranked.slice(0, top)) console.log(`  ${pad(count, 5)}  ${label}`);
      }
    }

    if (transcriptCheck) {
      console.log("\n--- of the NOT-IN-GOLD items, do the finding's own words appear in the dictation? ---");
      console.log('    (a screen, not a verdict: it shows the topic was discussed, not that the polarity is right)');
      for (const s of ['ros', 'exam', 'diagnoses']) {
        const t = tallies[s];
        if (t.notInGold === 0) continue;
        const pct = Math.round((100 * t.grounded) / (t.grounded + t.ungrounded));
        console.log(
          `    ${s.padEnd(10)} notInGold ${pad(t.notInGold, 5)}   words in transcript ${pad(
            t.grounded,
            5
          )} (${pct}%)   not found ${pad(t.ungrounded, 5)}`
        );
      }
    }

    for (const s of SECTIONS) {
      if (onlySection && s !== onlySection) continue;
      const t = tallies[s];
      if (t.notInGold === 0) continue;
      const ranked = [...t.offenders.entries()].sort((a, b) => b[1] - a[1]);
      console.log(
        `\n--- ${s}: charted but nowhere in gold — ${t.notInGold} items, ${ranked.length} distinct (top ${Math.min(
          top,
          ranked.length
        )}) ---`
      );
      for (const [label, count] of ranked.slice(0, top)) console.log(`  ${pad(count, 5)}  ${label}`);
    }
    console.log();
  }
}

main();
