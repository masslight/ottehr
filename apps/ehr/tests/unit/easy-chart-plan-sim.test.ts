// TEMPORARY diagnostic harness (not a regression test): replays planner steps captured by
// run-planner.ts through the REAL client-side matchers, printing what the auto-pick would chart.
// Surfaces ROS/exam leaf mismatches and strength-key false mismatches without a browser session.
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { EXAM_LEAVES, ROS_LEAVES } from '../../src/features/easy-charting/exam-ros-catalog';
import {
  findExamLeafMatchesScored,
  findRosLeafMatchesScored,
  preferredExamLeaf,
  strengthCompatible,
  strengthKey,
} from '../../src/features/easy-charting/intent-logic';

const DIR =
  process.env.EASY_CHART_SIM_DIR ??
  '/private/tmp/claude-501/-Users-dabrams-development-ottehr/29c6ad6e-bbf6-47ac-b84a-3c1836314c9c/scratchpad/uc2';

interface Step {
  kind: string;
  display?: string;
  searchTerms?: string[];
  finding?: string;
  strength?: string;
  sourceText?: string;
}

function loadPlans(): Array<{ name: string; steps: Step[] }> {
  const out: Array<{ name: string; steps: Step[] }> = [];
  for (const f of readdirSync(DIR).filter((f) => f.startsWith('plan-') && f.endsWith('.log'))) {
    const raw = readFileSync(join(DIR, f), 'utf8');
    const idx = raw.indexOf('===== RAW JSON =====');
    if (idx === -1) continue;
    try {
      out.push({ name: f, steps: JSON.parse(raw.slice(idx + 21)).steps as Step[] });
    } catch {
      console.log(`(could not parse ${f})`);
    }
  }
  return out;
}

describe('plan → client-matcher simulation', () => {
  // Diagnostic harness: only runs when a scratchpad capture exists (never on CI).
  it.skipIf(!existsSync(DIR))('replays ROS/exam steps through the real matchers', () => {
    const plans = loadPlans();
    expect(plans.length).toBeGreaterThanOrEqual(0);
    for (const { name, steps } of plans) {
      console.log(`\n════ ${name} ════`);
      for (const s of steps) {
        if (s.kind === 'add-ros-finding' && s.display) {
          const verb = /^(denies|reports)\b[:\s-]*/i.exec(s.display);
          const symptom = s.display.replace(/^(denies|reports)\b[:\s-]*/i, '').trim();
          const scored = findRosLeafMatchesScored(
            { kind: 'add-ros-finding', display: symptom || s.display, searchTerms: s.searchTerms ?? [] },
            ROS_LEAVES
          );
          const pick = scored[0];
          console.log(
            `  ROS  "${s.display}" → ${
              pick
                ? `${verb?.[1] ?? 'reports'} [${pick.leaf.label}] (score ${pick.score}${
                    scored.length > 1 ? `, next: ${scored[1].leaf.label}@${scored[1].score}` : ''
                  })`
                : 'NO MATCH (skipped)'
            }`
          );
        }
        if (s.kind === 'add-exam-finding' && s.display) {
          const scored = findExamLeafMatchesScored(
            { kind: 'add-exam-finding', display: s.display, searchTerms: s.searchTerms ?? [] },
            EXAM_LEAVES
          );
          const isNegated = /\b(no|not|non|without|denies?|denied|negative|absent|neg)\b/i.test(s.display);
          const allAbnormal = scored.length > 0 && scored.every((x) => x.leaf.normalAbnormal === 'abnormal');
          const guard = isNegated && allAbnormal ? ' [NEGATION-GUARD → skip]' : '';
          const pick = scored.length ? preferredExamLeaf(scored) : undefined;
          console.log(
            `  EXAM "${s.display}" → ${
              pick
                ? `[${pick.label}] (${pick.normalAbnormal}, top score ${scored[0].score})${guard}`
                : 'NO MATCH (skipped)'
            }`
          );
        }
        if (s.kind === 'add-medication' && s.strength) {
          console.log(`  MED  "${s.display}" strength "${s.strength}" → key ${strengthKey(s.strength)}`);
        }
      }
    }
  });

  it.skipIf(!existsSync(DIR))('probes strengthKey equivalences that gate the med picker', () => {
    const cases: Array<[string, string, string]> = [
      ['0.5 %', '5 MG/GM', 'erythromycin ophthalmic (percent vs mg/g)'],
      ['15 milligrams', '15 MG/5ML', 'Orapred oral solution (dose vs concentration)'],
      ['4 milligram', '4 MG', 'ondansetron ODT'],
      ['100 milligrams', '100 MG', 'Macrobid'],
      ['2 puffs', '90 MCG/ACT', 'albuterol HFA (puffs vs actuation)'],
    ];
    for (const [dictated, catalog, label] of cases) {
      const match = strengthCompatible(dictated, catalog);
      console.log(
        `  ${match ? 'MATCH   ' : 'MISMATCH'} ${label}: "${dictated}"=${strengthKey(
          dictated
        )} vs "${catalog}"=${strengthKey(catalog)}`
      );
    }
    expect(true).toBe(true);
  });
});
