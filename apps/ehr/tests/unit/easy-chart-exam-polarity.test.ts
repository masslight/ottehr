import { describe, expect, it } from 'vitest';
import { EXAM_LEAVES } from '../../src/features/easy-charting/exam-ros-catalog';
import { findExamLeafMatchesScored, preferredExamLeaf } from '../../src/features/easy-charting/intent-logic';

// Polarity safety: a dictated NEGATIVE ("conjunctiva clear with no injection") must never chart
// the abnormal assertion of the same finding ("Conjunctival injection"). Locks the live bug from
// the stye dictation where the anatomy word alone carried the match and the abnormal-preference
// picked the inverted leaf.
describe('exam matcher polarity', () => {
  const scoredFor = (display: string): { leaf: (typeof EXAM_LEAVES)[number]; score: number }[] =>
    findExamLeafMatchesScored({ kind: 'add-exam-finding', display, searchTerms: [] }, EXAM_LEAVES);

  it.each([
    'Left conjunctiva clear with no injection',
    'The left eye is clear with no injection',
    'Conjunctiva clear, no injection',
  ])('never returns abnormal "injection" for: %s', (display) => {
    const scored = scoredFor(display);
    for (const s of scored) {
      const asserts = /inject/i.test(s.leaf.label) && !/non-?injected|no injection/i.test(s.leaf.label);
      expect(s.leaf.normalAbnormal === 'abnormal' && asserts, `${s.leaf.label} should be vetoed`).toBe(false);
    }
    if (scored.length > 0) {
      const pick = preferredExamLeaf(scored, { queryNegated: true });
      expect(pick.normalAbnormal === 'abnormal' && /inject/i.test(pick.label)).toBe(false);
    }
  });

  it('still matches the POSITIVE assertion ("throat injected") to an abnormal leaf', () => {
    const scored = scoredFor('Posterior pharynx erythematous and injected');
    expect(scored.length).toBeGreaterThan(0);
    expect(scored[0].leaf.normalAbnormal).toBe('abnormal');
  });

  it('negated query prefers the normal side when both polarities score', () => {
    const scored = scoredFor('No conjunctival injection, sclera white');
    if (scored.length > 0) {
      const pick = preferredExamLeaf(scored, { queryNegated: true });
      expect(pick.normalAbnormal === 'abnormal' && /inject/i.test(pick.label)).toBe(false);
    }
  });
});
