import { describe, expect, it } from 'vitest';
import { HOLD_TAG_NAME } from './rules-engine.constants';
import { PreSubmissionRule, RuleActionSchema, SaveBillingRulesInputSchema } from './rules-engine.schemas';

// Schema-layer tests only: the engine's evaluator/serialization are backend code and are tested in
// packages/zambdas/test/unit/billing/rules-engine.test.ts.

describe('applyTag canonicalization', () => {
  it('normalizes case/whitespace variants of the Hold tag to the exact name', () => {
    expect(RuleActionSchema.parse({ type: 'applyTag', tag: '  hold ' })).toEqual({
      type: 'applyTag',
      tag: HOLD_TAG_NAME,
    });
    expect(RuleActionSchema.parse({ type: 'applyTag', tag: 'HOLD' })).toEqual({ type: 'applyTag', tag: HOLD_TAG_NAME });
    expect(RuleActionSchema.parse({ type: 'applyTag', tag: ' VIP ' })).toEqual({ type: 'applyTag', tag: 'VIP' });
  });
});

describe('SaveBillingRulesInputSchema', () => {
  const rule = (id: string): PreSubmissionRule => ({
    id,
    name: id,
    description: '',
    enabled: true,
    conditional: { branches: [{ condition: { type: 'all' }, outcome: { type: 'noop' } }] },
  });

  it('accepts a valid ordered list', () => {
    expect(SaveBillingRulesInputSchema.safeParse({ rules: [rule('a'), rule('b')] }).success).toBe(true);
  });

  it('rejects duplicate rule ids', () => {
    expect(SaveBillingRulesInputSchema.safeParse({ rules: [rule('a'), rule('a')] }).success).toBe(false);
  });

  it('accepts new rules without ids — the backend assigns them on save', () => {
    const { id: _a, ...newRuleA } = rule('a');
    const { id: _b, ...newRuleB } = rule('b');
    const parsed = SaveBillingRulesInputSchema.safeParse({ rules: [newRuleA, newRuleB, rule('c')] });
    expect(parsed.success).toBe(true);
  });
});
