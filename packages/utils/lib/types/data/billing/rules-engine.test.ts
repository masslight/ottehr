import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES_ENGINE, HOLD_TAG_NAME } from './rules-engine.constants';
import { BillingRule, RuleActionSchema, SaveBillingRulesInputSchema } from './rules-engine.schemas';

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
  const rule = (id: string): BillingRule => ({
    id,
    name: id,
    description: '',
    enabled: true,
    conditional: { branches: [{ condition: { type: 'all' }, outcome: { type: 'noop' } }] },
  });

  it('accepts a valid ordered list', () => {
    expect(SaveBillingRulesInputSchema.safeParse({ rules: [rule('a'), rule('b')] }).success).toBe(true);
  });

  it('defaults the engine to Claim Submission and rejects unknown engines', () => {
    const parsed = SaveBillingRulesInputSchema.safeParse({ rules: [rule('a')] });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.engine).toBe(DEFAULT_RULES_ENGINE);
    expect(
      SaveBillingRulesInputSchema.safeParse({ engine: 'patient-ar-pre-invoice', rules: [rule('a')] }).success
    ).toBe(true);
    expect(SaveBillingRulesInputSchema.safeParse({ engine: 'nope', rules: [rule('a')] }).success).toBe(false);
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
