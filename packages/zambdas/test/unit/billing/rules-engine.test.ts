import { Basic, Claim } from 'fhir/r4b';
import {
  CLAIM_TAG_SYSTEM,
  FHIR_IDENTIFIER_NPI,
  getPayerUrl,
  HOLD_TAG_NAME,
  PreSubmissionRule,
  RULE_FIELD_CATALOG,
} from 'utils';
import { describe, expect, it } from 'vitest';
import {
  READABLE_FIELD_IDS,
  readField,
  RulesEngineClaimModel,
  WRITABLE_FIELD_IDS,
} from '../../../src/billing/rules-engine/claim-model';
import {
  PRESUBMISSION_RULES_TASK_CODE,
  PRESUBMISSION_RULES_TASK_SYSTEM,
  RULE_DEFINITION_EXTENSION_URL,
} from '../../../src/billing/rules-engine/constants';
import { evaluateCondition, evaluateOperator, executeRule } from '../../../src/billing/rules-engine/evaluator';
import { buildRulesEngineKickoffTask, listToRules, rulesToList } from '../../../src/billing/rules-engine/serialization';

const makeModel = (): RulesEngineClaimModel => ({
  claim: {
    resourceType: 'Claim',
    status: 'draft',
    use: 'claim',
    type: { coding: [] },
    patient: { reference: 'Patient/p1' },
    created: '2026-01-01',
    provider: {},
    priority: { coding: [] },
    insurance: [],
  } as Claim,
  patient: {
    resourceType: 'Patient',
    name: [{ given: ['Jane'], family: 'Doe' }],
    birthDate: '1990-01-01',
    gender: 'female',
  },
  coverages: [
    {
      resourceType: 'Coverage',
      status: 'active',
      beneficiary: { reference: 'Patient/p1' },
      payor: [{ reference: getPayerUrl('123456') }],
    },
  ],
  renderingProvider: {
    resourceType: 'Practitioner',
    name: [{ family: 'Smith' }],
    identifier: [{ system: FHIR_IDENTIFIER_NPI, value: '1234567890' }],
  },
  serviceFacility: {
    resourceType: 'Location',
    name: 'Main Clinic',
    address: { state: 'CA' },
    identifier: [{ system: FHIR_IDENTIFIER_NPI, value: '9999999999' }],
  },
});

const claimTags = (model: RulesEngineClaimModel): string[] =>
  (model.claim.meta?.tag ?? []).filter((t) => t.system === CLAIM_TAG_SYSTEM).map((t) => t.code as string);

describe('field catalog / claim-model pairing', () => {
  // The catalog (utils) drives the rule-builder UI; the readers/writers live here. Guard the pairing
  // so adding a field to one side without the other fails fast.
  it('every catalog field has a reader, and exactly the settable fields have writers', () => {
    const catalogIds = RULE_FIELD_CATALOG.map((f) => f.id);
    expect([...READABLE_FIELD_IDS].sort()).toEqual([...catalogIds].sort());
    const settableIds = RULE_FIELD_CATALOG.filter((f) => f.settable).map((f) => f.id);
    expect([...WRITABLE_FIELD_IDS].sort()).toEqual([...settableIds].sort());
  });
});

describe('rules-engine evaluator', () => {
  it('evaluateOperator covers the operators', () => {
    expect(evaluateOperator('eq', '123456', '123456')).toBe(true);
    expect(evaluateOperator('eq', '123456', '999')).toBe(false);
    expect(evaluateOperator('neq', '123456', '999')).toBe(true);
    expect(evaluateOperator('in', 'b', ['a', 'b', 'c'])).toBe(true);
    expect(evaluateOperator('notIn', 'z', ['a', 'b'])).toBe(true);
    expect(evaluateOperator('contains', ['Hold', 'VIP'], 'Hold')).toBe(true);
    expect(evaluateOperator('notContains', ['VIP'], 'Hold')).toBe(true);
    expect(evaluateOperator('exists', '')).toBe(false);
    expect(evaluateOperator('exists', 'x')).toBe(true);
    expect(evaluateOperator('notExists', undefined)).toBe(true);
  });

  it('reads logical fields that span resources', () => {
    const m = makeModel();
    expect(readField(m, 'payerId')).toBe('123456');
    expect(readField(m, 'patient.birthDate')).toBe('1990-01-01');
    expect(readField(m, 'serviceFacility.state')).toBe('CA');
    expect(readField(m, 'renderingProvider.npi')).toBe('1234567890');
    expect(readField(m, 'tags')).toEqual([]);
  });

  it('evaluateCondition handles all / field / and / or groups', () => {
    const m = makeModel();
    expect(evaluateCondition({ type: 'all' }, m)).toBe(true);
    expect(evaluateCondition({ type: 'field', field: 'payerId', operator: 'eq', value: '123456' }, m)).toBe(true);
    expect(
      evaluateCondition(
        {
          type: 'group',
          logic: 'and',
          conditions: [
            { type: 'field', field: 'payerId', operator: 'eq', value: '123456' },
            { type: 'field', field: 'serviceFacility.state', operator: 'eq', value: 'CA' },
          ],
        },
        m
      )
    ).toBe(true);
    expect(
      evaluateCondition(
        {
          type: 'group',
          logic: 'or',
          conditions: [
            { type: 'field', field: 'payerId', operator: 'eq', value: 'nope' },
            { type: 'field', field: 'serviceFacility.state', operator: 'eq', value: 'CA' },
          ],
        },
        m
      )
    ).toBe(true);
  });

  it('executes the canonical "remap payer id" rule', () => {
    const m = makeModel();
    const rule: PreSubmissionRule = {
      id: 'r-remap',
      name: 'Remap payer',
      description: 'If payer 123456 then set payer to 999999',
      enabled: true,
      conditional: {
        branches: [
          {
            condition: { type: 'field', field: 'payerId', operator: 'eq', value: '123456' },
            outcome: { type: 'actions', actions: [{ type: 'setField', field: 'payerId', value: '999999' }] },
          },
        ],
      },
    };
    const result = executeRule(rule, m);
    expect(result.held).toBe(false);
    expect(readField(m, 'payerId')).toBe('999999');
    // It re-points the claim's own working copies (Coverage.payor + Claim.insurer), not a display value.
    expect(m.coverages[0].payor?.[0]?.reference).toContain('999999');
    expect(m.claim.insurer?.reference).toContain('999999');
  });

  it('follows nested else-if branches', () => {
    const m = makeModel();
    const rule: PreSubmissionRule = {
      id: 'r-nested',
      name: 'Nested',
      description: '',
      enabled: true,
      conditional: {
        branches: [
          {
            condition: { type: 'field', field: 'payerId', operator: 'eq', value: 'AAA' },
            outcome: { type: 'actions', actions: [{ type: 'setField', field: 'patient.gender', value: 'male' }] },
          },
          {
            condition: { type: 'field', field: 'payerId', operator: 'eq', value: '123456' },
            outcome: {
              type: 'conditional',
              conditional: {
                branches: [
                  {
                    condition: { type: 'field', field: 'serviceFacility.state', operator: 'eq', value: 'CA' },
                    outcome: { type: 'actions', actions: [{ type: 'applyTag', tag: 'NeedsReview' }] },
                  },
                ],
                otherwise: { type: 'noop' },
              },
            },
          },
        ],
      },
    };
    executeRule(rule, m);
    expect(readField(m, 'patient.gender')).toBe('female'); // first branch not taken
    expect(claimTags(m)).toContain('NeedsReview');
  });

  it('halts on the Hold tag and skips disabled rules', () => {
    const m = makeModel();
    const holdRule: PreSubmissionRule = {
      id: 'r-hold',
      name: 'Always hold',
      description: '',
      enabled: true,
      conditional: {
        branches: [
          {
            condition: { type: 'all' },
            outcome: {
              type: 'actions',
              actions: [
                { type: 'applyTag', tag: HOLD_TAG_NAME },
                { type: 'setField', field: 'patient.lastName', value: 'ShouldNotApply' },
              ],
            },
          },
        ],
      },
    };
    const result = executeRule(holdRule, m);
    expect(result.held).toBe(true);
    expect(claimTags(m)).toContain(HOLD_TAG_NAME);
    // The action after the Hold tag must not run.
    expect(readField(m, 'patient.lastName')).toBe('Doe');

    const disabled: PreSubmissionRule = { ...holdRule, id: 'r-off', enabled: false };
    const m2 = makeModel();
    expect(executeRule(disabled, m2).held).toBe(false);
    expect(claimTags(m2)).toEqual([]);
  });

  it('stops with an error when a setField action cannot be applied', () => {
    const m = makeModel();
    m.renderingProvider = undefined; // the action's target is missing from the claim
    const rule: PreSubmissionRule = {
      id: 'r-bad',
      name: 'Set rendering NPI',
      description: '',
      enabled: true,
      conditional: {
        branches: [
          {
            condition: { type: 'all' },
            outcome: {
              type: 'actions',
              actions: [
                { type: 'setField', field: 'renderingProvider.npi', value: '5555555555' },
                { type: 'setField', field: 'patient.lastName', value: 'ShouldNotApply' },
              ],
            },
          },
        ],
      },
    };
    const result = executeRule(rule, m);
    expect(result.error).toContain('renderingProvider.npi');
    expect(result.held).toBe(false);
    // The run stops at the failed action; later actions must not apply.
    expect(readField(m, 'patient.lastName')).toBe('Doe');
  });
});

describe('rules-engine serialization', () => {
  const rules: PreSubmissionRule[] = [
    {
      id: 'rule-a',
      name: 'Rule A',
      description: 'first',
      enabled: true,
      conditional: {
        branches: [
          {
            condition: { type: 'field', field: 'payerId', operator: 'eq', value: '123456' },
            outcome: { type: 'actions', actions: [{ type: 'setField', field: 'payerId', value: '999999' }] },
          },
        ],
      },
    },
    {
      id: 'rule-b',
      name: 'Rule B',
      description: '',
      enabled: false,
      conditional: {
        branches: [
          {
            condition: { type: 'all' },
            outcome: { type: 'actions', actions: [{ type: 'applyTag', tag: HOLD_TAG_NAME }] },
          },
        ],
      },
    },
  ];

  it('round-trips rules through a contained-Basic List preserving order', () => {
    const list = rulesToList(rules);
    expect(list.resourceType).toBe('List');
    expect(list.contained).toHaveLength(2);
    expect(list.entry?.map((e) => e.item?.reference)).toEqual(['#rule-a', '#rule-b']);
    expect(listToRules(list)).toEqual(rules);
  });

  it('reflects reordering via entry order', () => {
    const reordered = [rules[1], rules[0]];
    const list = rulesToList(reordered);
    expect(listToRules(list).map((r) => r.id)).toEqual(['rule-b', 'rule-a']);
  });

  it('surfaces an unparseable rule as a disabled placeholder instead of failing the whole list', () => {
    const list = rulesToList(rules);
    const badRule = list.contained?.[0] as Basic;
    const definition = badRule.extension?.find((e) => e.url === RULE_DEFINITION_EXTENSION_URL);
    definition!.valueString = '{not valid json';

    const parsed = listToRules(list);
    expect(parsed).toHaveLength(2);
    // The broken rule survives (so a full-list save doesn't delete it) but is disabled and inert.
    expect(parsed[0]).toMatchObject({ id: 'rule-a', name: 'Rule A', enabled: false, conditional: { branches: [] } });
    expect(parsed[1]).toEqual(rules[1]);
  });
});

describe('rules-engine kickoff task', () => {
  it('builds a requested Task focused on the claim with the engine code', () => {
    const task = buildRulesEngineKickoffTask('claim-123');
    expect(task.status).toBe('requested');
    expect(task.focus?.reference).toBe('Claim/claim-123');
    expect(task.code?.coding?.[0]).toEqual({
      system: PRESUBMISSION_RULES_TASK_SYSTEM,
      code: PRESUBMISSION_RULES_TASK_CODE,
    });
  });
});
