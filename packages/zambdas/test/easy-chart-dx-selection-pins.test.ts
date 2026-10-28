import { buildPrompt } from 'utils/lib/easy-chart/prompt';
import { describe, expect, it } from 'vitest';

const buildPlannerPrompt = (narrative: string): string => buildPrompt({ narrative });

// Pins two rules in the prompt's fixed block: a stated diagnosis is never escalated to one inferred
// from findings, and later statements override walked-back earlier impressions.
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
});
