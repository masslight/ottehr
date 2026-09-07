// The whole of `summary.json` for one run, as eight tables — the full-fidelity view.
//
// `report.ts` is the DELTA tool and deliberately shows a subset: the sections, the E&M line and the
// counters, because a comparison wants a few numbers you can hold in your head. This one is the
// opposite: every field the scorer records, for a single run, in a fixed layout so two runs can be put
// side by side by eye and nothing is quietly omitted. Reading only the headline metrics is how a
// medication-precision regression (0.235 → 0.120) sat unnoticed behind an E&M gain.
//
// PHI: reads `summary.json` only — counts and pattern labels, never clinical text.
//
// Usage:
//   npx tsx tools/easy-chart-eval/summary-table.ts <runDir> [<runDir>...]

import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

interface SectionLike {
  gold: number;
  predicted: number;
  matched: number;
  contextGold: number;
  contextCharted: number;
  unvoicedGold: number;
  unvoicedMatched: number;
  precision: number | null;
  recall: number | null;
}

type Scope = 'plannerOnly' | 'final';

interface Summary {
  scoredCases: number;
  scopes: Record<
    Scope,
    {
      sections: Record<string, SectionLike>;
      em: { goldCases: number; predictedCases: number; matched: number; levelMatched: number };
      primaryDx: Record<string, number>;
      rosPolarity: { matched: number; agree: number };
      examAbnormal: { matched: number; agree: number };
      medsCombined: Record<string, number>;
      medsVoicing: Record<string, number>;
    }
  >;
  freeText: Record<string, { goldPresent: number; predictedPresent: number; bothPresent: number }>;
  contextCharted: Record<string, number>;
  counters: Record<string, number>;
  dispositionVoiced: Record<string, number>;
  dispositionTrigger: Record<string, number | Record<string, number>>;
  usage: Record<string, Record<string, number>>;
  escalation: Record<
    string,
    {
      primaryOk: number;
      primaryFailed: number;
      reasons: Record<string, number>;
      okProviders: Record<string, number>;
      noData: number;
    }
  >;
}

const SECTION_ORDER = ['diagnoses', 'cpt', 'ros', 'exam', 'medsPrescribed', 'medsInHouse', 'immunizations'];
const SCOPES: Scope[] = ['plannerOnly', 'final'];

const n = (v: number | null | undefined, digits = 3): string =>
  v == null ? '—' : v.toFixed(digits).replace(/^0\./, '.');
const pad = (v: string | number, w: number): string => String(v).padStart(w);
const padE = (v: string, w: number): string => v.padEnd(w);
const pct = (a: number, b: number): string => (b === 0 ? '—' : `${Math.round((a / b) * 100)}%`);

function render(dir: string): void {
  const s = JSON.parse(readFileSync(join(dir, 'summary.json'), 'utf8')) as Summary;
  console.log(`\n${'='.repeat(96)}\n${basename(dir)}   —   ${s.scoredCases} cases\n${'='.repeat(96)}`);

  console.log('\n1. SECTION METRICS');
  console.log('   gold = gold items in scope (voiced + untagged). ctxG/ctxC = context items, outside both');
  console.log('   denominators. unvG/unvM = gold tagged voiced:false, and predictions landing on them.');
  console.log('   Precision denominator = pred - ctxC - unvM.\n');
  console.log(
    `   ${padE('section', 15)}${padE('scope', 9)}${pad('gold', 5)}${pad('pred', 6)}${pad('match', 6)}${pad(
      'ctxG',
      5
    )}${pad('ctxC', 5)}${pad('unvG', 6)}${pad('unvM', 5)}${pad('P', 6)}${pad('R', 6)}`
  );
  for (const sec of SECTION_ORDER) {
    for (const scope of SCOPES) {
      const x = s.scopes[scope]?.sections?.[sec];
      if (!x) continue;
      console.log(
        `   ${padE(sec, 15)}${padE(scope === 'plannerOnly' ? 'planner' : 'final', 9)}${pad(x.gold, 5)}${pad(
          x.predicted,
          6
        )}${pad(x.matched, 6)}${pad(x.contextGold, 5)}${pad(x.contextCharted, 5)}${pad(x.unvoicedGold, 6)}${pad(
          x.unvoicedMatched,
          5
        )}${pad(n(x.precision), 6)}${pad(n(x.recall), 6)}`
      );
    }
  }
  console.log('\n   medsPrescribed / medsInHouse / immunizations share ONE pool of predicted medications, so');
  console.log('   per-section precision there is deliberately null — medsCombined below carries it.');

  console.log('\n2. SCALAR METRICS BY SCOPE');
  const p = s.scopes.plannerOnly;
  const f = s.scopes.final;
  const rows: [string, string | number, string | number][] = [
    ['E&M: gold cases', p.em.goldCases, f.em.goldCases],
    ['E&M: predicted', p.em.predictedCases, f.em.predictedCases],
    [
      'E&M: exact match',
      `${p.em.matched} (${pct(p.em.matched, p.em.goldCases)})`,
      `${f.em.matched} (${pct(f.em.matched, f.em.goldCases)})`,
    ],
    [
      'E&M: level match',
      `${p.em.levelMatched} (${pct(p.em.levelMatched, p.em.goldCases)})`,
      `${f.em.levelMatched} (${pct(f.em.levelMatched, f.em.goldCases)})`,
    ],
    ['primary dx: gold cases', p.primaryDx.goldCases, f.primaryDx.goldCases],
    ['primary dx: both charted', p.primaryDx.bothPresent, f.primaryDx.bothPresent],
    ['primary dx: matched', p.primaryDx.matched, f.primaryDx.matched],
    [
      'primary dx: voiced num/den',
      `${p.primaryDx.voicedMatched}/${p.primaryDx.voicedBoth}`,
      `${f.primaryDx.voicedMatched}/${f.primaryDx.voicedBoth}`,
    ],
    ['primary dx: unvoicedGold', p.primaryDx.unvoicedGold, f.primaryDx.unvoicedGold],
    ['primary dx: noData', p.primaryDx.noData, f.primaryDx.noData],
    [
      'ROS polarity agree/matched',
      `${p.rosPolarity.agree}/${p.rosPolarity.matched}`,
      `${f.rosPolarity.agree}/${f.rosPolarity.matched}`,
    ],
    [
      'exam abnormal agree/matched',
      `${p.examAbnormal.agree}/${p.examAbnormal.matched}`,
      `${f.examAbnormal.agree}/${f.examAbnormal.matched}`,
    ],
    ['medsCombined: pred', p.medsCombined.predicted, f.medsCombined.predicted],
    ['medsCombined: matched', p.medsCombined.matched, f.medsCombined.matched],
    ['medsCombined: intentMatched', p.medsCombined.intentMatched, f.medsCombined.intentMatched],
    ['medsCombined: P', n(p.medsCombined.precision), n(f.medsCombined.precision)],
    ['medsVoicing: legacyVoiced', p.medsVoicing.legacyVoiced, f.medsVoicing.legacyVoiced],
    ['medsVoicing: intentVoiced', p.medsVoicing.intentVoiced, f.medsVoicing.intentVoiced],
    [
      'medsVoicing: intentCovered',
      `${p.medsVoicing.intentCovered} (${pct(p.medsVoicing.intentCovered, p.medsVoicing.intentVoiced)})`,
      `${f.medsVoicing.intentCovered} (${pct(f.medsVoicing.intentCovered, f.medsVoicing.intentVoiced)})`,
    ],
  ];
  console.log(`   ${padE('metric', 30)}${pad('planner', 14)}${pad('final', 14)}`);
  for (const [label, a, b] of rows) console.log(`   ${padE(label, 30)}${pad(a, 14)}${pad(b, 14)}`);

  console.log('\n3. FREE TEXT (presence only, not content)');
  console.log(`   ${padE('field', 26)}${pad('gold', 6)}${pad('pred', 6)}${pad('both', 6)}`);
  for (const [k, v] of Object.entries(s.freeText)) {
    console.log(`   ${padE(k, 26)}${pad(v.goldPresent, 6)}${pad(v.predictedPresent, 6)}${pad(v.bothPresent, 6)}`);
  }

  console.log('\n4. CONTEXT ITEMS CHARTED');
  for (const [k, v] of Object.entries(s.contextCharted)) console.log(`   ${padE(k, 30)}${pad(v, 6)}`);

  console.log('\n5. COUNTERS');
  for (const [k, v] of Object.entries(s.counters)) console.log(`   ${padE(k, 30)}${pad(v, 6)}`);

  console.log('\n6. DISPOSITION');
  for (const [k, v] of Object.entries(s.dispositionVoiced))
    console.log(`   ${padE(`voiced-scoping: ${k}`, 34)}${pad(v, 6)}`);
  for (const [k, v] of Object.entries(s.dispositionTrigger)) {
    if (typeof v === 'number') console.log(`   ${padE(`trigger: ${k}`, 34)}${pad(v, 6)}`);
    else
      console.log(
        `   ${padE('trigger: byPattern', 34)}  ${
          Object.entries(v)
            .map(([a, b]) => `${a} ${b}`)
            .join(', ') || '—'
        }`
      );
  }

  console.log('\n7. TOKENS');
  console.log(
    `   ${padE('stage', 10)}${pad('calls', 7)}${pad('in', 10)}${pad('out', 9)}${pad('cacheR', 9)}${pad(
      'cacheW',
      9
    )}${pad('thinking', 10)}`
  );
  for (const [stage, u] of Object.entries(s.usage)) {
    console.log(
      `   ${padE(stage, 10)}${pad(u.calls, 7)}${pad(u.inputTokens, 10)}${pad(u.outputTokens, 9)}${pad(
        u.cacheReadTokens,
        9
      )}${pad(u.cacheWriteTokens, 9)}${pad(u.thinkingTokens, 10)}`
    );
  }

  console.log('\n8. MODEL ESCALATION');
  console.log(
    `   ${padE('stage', 10)}${pad('primaryOk', 11)}${pad('failed', 10)}${padE('  reasons', 22)}${padE(
      'providers',
      16
    )}${pad('noData', 8)}`
  );
  for (const [stage, e] of Object.entries(s.escalation)) {
    const reasons =
      Object.entries(e.reasons ?? {})
        .map(([k, v]) => `${k} x${v}`)
        .join(', ') || '—';
    const provs =
      Object.entries(e.okProviders ?? {})
        .map(([k, v]) => `${k} ${v}`)
        .join(', ') || '—';
    const total = e.primaryOk + e.primaryFailed;
    console.log(
      `   ${padE(stage, 10)}${pad(e.primaryOk, 11)}${pad(
        `${e.primaryFailed} (${pct(e.primaryFailed, total)})`,
        10
      )}${padE(`  ${reasons}`, 22)}${padE(provs, 16)}${pad(e.noData, 8)}`
    );
  }
}

const dirs = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (dirs.length === 0) {
  console.error('usage: summary-table.ts <runDir> [<runDir>...]');
  process.exit(1);
}
for (const dir of dirs) {
  if (!existsSync(join(dir, 'summary.json'))) throw new Error(`no summary.json in ${dir}`);
  render(dir);
}
