import { buildPrompt } from 'utils/lib/easy-chart/prompt';
import { describe, expect, it } from 'vitest';

const buildPlannerPrompt = (narrative: string): string => buildPrompt('plan', { narrative });
const buildReviewPrompt = (narrative: string): string => buildPrompt('review', { narrative });

// Regression pins for the two diagnosis-selection rules added after the failure-mode audit of the
// production-derived eval corpus: (1) a provider-STATED diagnosis must never be escalated to a
// more severe condition inferred from findings, and (2) the narrative is a real-time record —
// LATER statements govern over walked-back earlier impressions (in both directions: a retracted
// impression is not charted, and a result that replaces a working theory is). Both rules live in
// each prompt's FIXED instruction block; these pins keep a future prompt refactor from silently
// dropping them. All inputs are synthetic.
describe('easy-chart dx-selection rule pins', () => {
  const fixedPrefixOf = (p: string): string => {
    const i = p.indexOf('═══ END OF FIXED INSTRUCTIONS');
    expect(i).toBeGreaterThan(0);
    return p.slice(0, i);
  };

  it('planner fixed block carries the later-revision and stated-diagnosis rules', () => {
    const prefix = fixedPrefixOf(buildPlannerPrompt('Synthetic narrative.'));
    expect(prefix).toContain('Never chart a walked-back impression');
    expect(prefix).toContain('STATED DIAGNOSIS WINS');
  });

  it('review fixed block carries the later-statements and no-escalation principles', () => {
    const prefix = fixedPrefixOf(buildReviewPrompt('Synthetic narrative.'));
    expect(prefix).toContain('LATER STATEMENTS ARE GROUND TRUTH');
    expect(prefix).toContain('NEVER ESCALATE A STATED DIAGNOSIS');
  });
});
