// Prints every field of a run's `summary.json` as eight fixed-layout tables, so runs can be compared side by
// side. `report.ts` is the delta tool and shows only a subset.
//
// PHI: reads `summary.json` only, which holds counts and pattern labels, never clinical text.
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

interface Summary {
  scoredCases: number;
  sections: Record<string, SectionLike>;
  em: { goldCases: number; predictedCases: number; matched: number; levelMatched: number };
  primaryDx: Record<string, number>;
  rosPolarity: { matched: number; agree: number };
  examAbnormal: { matched: number; agree: number };
  medsCombined: Record<string, number>;
  medsVoicing: Record<string, number>;
  freeText: Record<string, { goldPresent: number; predictedPresent: number; bothPresent: number }>;
  contextCharted: Record<string, number>;
  counters: Record<string, number>;
  dispositionVoiced: Record<string, number>;
  dispositionTrigger: Record<string, number | Record<string, number>>;
  usage: Record<string, number>;
  escalation: {
    primaryOk: number;
    primaryFailed: number;
    reasons: Record<string, number>;
    okProviders: Record<string, number>;
    noData: number;
  };
}

const SECTION_ORDER = ['diagnoses', 'cpt', 'ros', 'exam', 'medsPrescribed', 'medsInHouse', 'immunizations'];

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
    `   ${padE('section', 15)}${pad('gold', 5)}${pad('pred', 6)}${pad('match', 6)}${pad('ctxG', 5)}${pad(
      'ctxC',
      5
    )}${pad('unvG', 6)}${pad('unvM', 5)}${pad('P', 6)}${pad('R', 6)}`
  );
  for (const sec of SECTION_ORDER) {
    const x = s.sections[sec];
    if (!x) continue;
    console.log(
      `   ${padE(sec, 15)}${pad(x.gold, 5)}${pad(x.predicted, 6)}${pad(x.matched, 6)}${pad(x.contextGold, 5)}${pad(
        x.contextCharted,
        5
      )}${pad(x.unvoicedGold, 6)}${pad(x.unvoicedMatched, 5)}${pad(n(x.precision), 6)}${pad(n(x.recall), 6)}`
    );
  }
  console.log('\n   medsPrescribed / medsInHouse / immunizations share ONE pool of predicted medications, so');
  console.log('   per-section precision there is deliberately null — medsCombined below carries it.');

  console.log('\n2. SCALAR METRICS');
  const rows: [string, string | number][] = [
    ['E&M: gold cases', s.em.goldCases],
    ['E&M: predicted', s.em.predictedCases],
    ['E&M: exact match', `${s.em.matched} (${pct(s.em.matched, s.em.goldCases)})`],
    ['E&M: level match', `${s.em.levelMatched} (${pct(s.em.levelMatched, s.em.goldCases)})`],
    ['primary dx: gold cases', s.primaryDx.goldCases],
    ['primary dx: both charted', s.primaryDx.bothPresent],
    ['primary dx: matched', s.primaryDx.matched],
    ['primary dx: voiced num/den', `${s.primaryDx.voicedMatched}/${s.primaryDx.voicedBoth}`],
    ['primary dx: unvoicedGold', s.primaryDx.unvoicedGold],
    ['primary dx: noData', s.primaryDx.noData],
    ['ROS polarity agree/matched', `${s.rosPolarity.agree}/${s.rosPolarity.matched}`],
    ['exam abnormal agree/matched', `${s.examAbnormal.agree}/${s.examAbnormal.matched}`],
    ['medsCombined: pred', s.medsCombined.predicted],
    ['medsCombined: matched', s.medsCombined.matched],
    ['medsCombined: intentMatched', s.medsCombined.intentMatched],
    ['medsCombined: P', n(s.medsCombined.precision)],
    ['medsVoicing: legacyVoiced', s.medsVoicing.legacyVoiced],
    ['medsVoicing: intentVoiced', s.medsVoicing.intentVoiced],
    [
      'medsVoicing: intentCovered',
      `${s.medsVoicing.intentCovered} (${pct(s.medsVoicing.intentCovered, s.medsVoicing.intentVoiced)})`,
    ],
  ];
  console.log(`   ${padE('metric', 30)}${pad('value', 14)}`);
  for (const [label, v] of rows) console.log(`   ${padE(label, 30)}${pad(v, 14)}`);

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
  const u = s.usage;
  console.log(
    `   ${pad('calls', 7)}${pad('in', 10)}${pad('out', 9)}${pad('cacheR', 9)}${pad('cacheW', 9)}${pad('thinking', 10)}`
  );
  console.log(
    `   ${pad(u.calls, 7)}${pad(u.inputTokens, 10)}${pad(u.outputTokens, 9)}${pad(u.cacheReadTokens, 9)}${pad(
      u.cacheWriteTokens,
      9
    )}${pad(u.thinkingTokens, 10)}`
  );

  console.log('\n8. MODEL ESCALATION');
  const e = s.escalation;
  console.log(
    `   ${pad('primaryOk', 11)}${pad('failed', 10)}${padE('  reasons', 22)}${padE('providers', 16)}${pad('noData', 8)}`
  );
  const reasons =
    Object.entries(e.reasons)
      .map(([k, v]) => `${k} x${v}`)
      .join(', ') || '—';
  const provs =
    Object.entries(e.okProviders)
      .map(([k, v]) => `${k} ${v}`)
      .join(', ') || '—';
  console.log(
    `   ${pad(e.primaryOk, 11)}${pad(
      `${e.primaryFailed} (${pct(e.primaryFailed, e.primaryOk + e.primaryFailed)})`,
      10
    )}${padE(`  ${reasons}`, 22)}${padE(provs, 16)}${pad(e.noData, 8)}`
  );
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
