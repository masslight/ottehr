import { describe, expect, it } from 'vitest';
import { HOLD_TAG_NAME } from './rules-engine.constants';
import { ADD_SERVICE_LINE_FIELDS, validateRuleFieldReferences } from './rules-engine.field-catalog';
import {
  AddServiceLineInputSchema,
  BillingRule,
  RuleActionSchema,
  SaveBillingRulesInputSchema,
} from './rules-engine.schemas';

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

describe('service line action schemas', () => {
  it('parses updateServiceLines and removeServiceLines actions', () => {
    const update = {
      type: 'updateServiceLines',
      match: { type: 'field', property: 'cptCode', operator: 'eq', value: '99213' },
      set: { property: 'cptCode', value: '99214' },
    };
    expect(RuleActionSchema.parse(update)).toEqual(update);

    const addModifier = {
      type: 'updateServiceLines',
      match: { type: 'all' },
      set: { property: 'modifiers', value: '25', operation: 'add' },
    };
    expect(RuleActionSchema.parse(addModifier)).toEqual(addModifier);

    const removeAll = { type: 'removeServiceLines', match: { type: 'all' } };
    expect(RuleActionSchema.parse(removeAll)).toEqual(removeAll);
  });

  it('rejects malformed matches and unknown operations', () => {
    expect(
      RuleActionSchema.safeParse({
        type: 'updateServiceLines',
        match: { type: 'field', property: '', operator: 'eq', value: 'x' },
        set: { property: 'cptCode', value: '99214' },
      }).success
    ).toBe(false);
    expect(
      RuleActionSchema.safeParse({
        type: 'updateServiceLines',
        match: { type: 'all' },
        set: { property: 'modifiers', value: '25', operation: 'append' },
      }).success
    ).toBe(false);
    expect(RuleActionSchema.safeParse({ type: 'removeServiceLines' }).success).toBe(false);
  });
});

describe('addServiceLine action schema', () => {
  it('the add-line field list matches the schema keys', () => {
    const schemaKeys = Object.keys(AddServiceLineInputSchema.shape).sort();
    const fieldIds = ADD_SERVICE_LINE_FIELDS.map((field) => field.id).sort();
    expect(fieldIds).toEqual(schemaKeys);
  });

  it('parses full and minimal lines, rejecting missing required fields', () => {
    const full = {
      type: 'addServiceLine',
      line: {
        cptCode: '87880',
        modifiers: 'QW, 59',
        units: '2',
        charges: '45.25',
        placeOfService: '11',
        serviceDate: '2026-02-02',
        diagnosisPointers: '1,2',
      },
    };
    expect(RuleActionSchema.parse(full)).toEqual(full);

    const minimal = { type: 'addServiceLine', line: { cptCode: '99050', charges: '30' } };
    expect(RuleActionSchema.parse(minimal)).toEqual(minimal);

    expect(RuleActionSchema.safeParse({ type: 'addServiceLine', line: { charges: '30' } }).success).toBe(false);
    expect(RuleActionSchema.safeParse({ type: 'addServiceLine', line: { cptCode: '99050' } }).success).toBe(false);
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
    expect(
      SaveBillingRulesInputSchema.safeParse({ engine: 'claim-submission', rules: [rule('a'), rule('b')] }).success
    ).toBe(true);
  });

  it('requires a known engine', () => {
    expect(SaveBillingRulesInputSchema.safeParse({ rules: [rule('a')] }).success).toBe(false);
    expect(
      SaveBillingRulesInputSchema.safeParse({ engine: 'patient-ar-pre-invoice', rules: [rule('a')] }).success
    ).toBe(true);
    expect(SaveBillingRulesInputSchema.safeParse({ engine: 'nope', rules: [rule('a')] }).success).toBe(false);
  });

  it('rejects duplicate rule ids', () => {
    expect(
      SaveBillingRulesInputSchema.safeParse({ engine: 'claim-submission', rules: [rule('a'), rule('a')] }).success
    ).toBe(false);
  });

  it('accepts new rules without ids — the backend assigns them on save', () => {
    const { id: _a, ...newRuleA } = rule('a');
    const { id: _b, ...newRuleB } = rule('b');
    const parsed = SaveBillingRulesInputSchema.safeParse({
      engine: 'claim-submission',
      rules: [newRuleA, newRuleB, rule('c')],
    });
    expect(parsed.success).toBe(true);
  });
});

describe('validateRuleFieldReferences', () => {
  const ruleWith = (conditional: BillingRule['conditional']): { name: string; conditional: typeof conditional } => ({
    name: 'My rule',
    conditional,
  });

  it('accepts a rule that only references catalog fields', () => {
    const problems = validateRuleFieldReferences(
      ruleWith({
        branches: [
          {
            condition: {
              type: 'group',
              logic: 'and',
              conditions: [
                { type: 'field', field: 'payerId', operator: 'eq', value: '123456' },
                { type: 'field', field: 'patient.birthDate', operator: 'lt', value: '2008-01-01' },
              ],
            },
            outcome: { type: 'actions', actions: [{ type: 'setField', field: 'status.arStage', value: 'patient-ar' }] },
          },
        ],
      })
    );
    expect(problems).toEqual([]);
  });

  it('reports unknown condition fields and unknown or read-only setField targets, including nested ones', () => {
    const problems = validateRuleFieldReferences(
      ruleWith({
        branches: [
          {
            condition: { type: 'field', field: 'not.a.field', operator: 'exists' },
            outcome: {
              type: 'conditional',
              conditional: {
                branches: [
                  {
                    condition: { type: 'all' },
                    outcome: { type: 'actions', actions: [{ type: 'setField', field: 'billed', value: '0' }] },
                  },
                ],
                otherwise: { type: 'actions', actions: [{ type: 'setField', field: 'nope', value: 'x' }] },
              },
            },
          },
        ],
      })
    );
    expect(problems).toHaveLength(3);
    expect(problems[0]).toContain('unknown property "not.a.field"');
    expect(problems[1]).toContain('read-only property "billed"');
    expect(problems[2]).toContain('unknown property "nope"');
  });

  it('validates service line matches and set targets', () => {
    const problems = validateRuleFieldReferences(
      ruleWith({
        branches: [
          {
            condition: { type: 'all' },
            outcome: {
              type: 'actions',
              actions: [
                {
                  type: 'updateServiceLines',
                  match: { type: 'field', property: 'notALineProperty', operator: 'eq', value: 'x' },
                  set: { property: 'alsoNotOne', value: 'y' },
                },
                {
                  type: 'updateServiceLines',
                  match: { type: 'field', property: 'modifiers', operator: 'gt', value: '2' },
                  set: { property: 'units', value: '2', operation: 'add' },
                },
                {
                  type: 'removeServiceLines',
                  match: { type: 'field', property: 'cptCode', operator: 'eq', value: '99213' },
                },
              ],
            },
          },
        ],
      })
    );
    expect(problems).toHaveLength(4);
    expect(problems[0]).toContain('matches service lines on unknown property "notALineProperty"');
    expect(problems[1]).toContain('updates unknown service line property "alsoNotOne"');
    expect(problems[2]).toContain('matches service lines on "modifiers" with unsupported operator "gt"');
    expect(problems[3]).toContain('uses operation "add" on non-list service line property "units"');
  });

  it('validates add-service-line field formats', () => {
    const problems = validateRuleFieldReferences(
      ruleWith({
        branches: [
          {
            condition: { type: 'all' },
            outcome: {
              type: 'actions',
              actions: [
                {
                  type: 'addServiceLine',
                  line: { cptCode: '99050', charges: 'a lot', units: '-1', diagnosisPointers: '1,x' },
                },
              ],
            },
          },
        ],
      })
    );
    expect(problems).toHaveLength(3);
    expect(problems[0]).toContain('adds a service line: Charges must be a non-negative number');
    expect(problems[1]).toContain('adds a service line: Units must be a positive number');
    expect(problems[2]).toContain('adds a service line: Diagnosis pointers must be comma-separated numbers');
  });
});
