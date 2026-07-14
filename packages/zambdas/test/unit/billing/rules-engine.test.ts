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
  writeField,
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
    insurance: [
      { sequence: 1, focal: true, coverage: { reference: 'Coverage/cov-primary' } },
      { sequence: 2, focal: false, coverage: { reference: 'Coverage/cov-secondary' } },
    ],
    diagnosis: [{ sequence: 1, diagnosisCodeableConcept: { coding: [{ code: 'J06.9' }] } }],
    item: [
      {
        sequence: 1,
        productOrService: { coding: [{ code: '99213' }] },
        servicedPeriod: { start: '2026-01-05' },
        locationCodeableConcept: { coding: [{ code: '20' }] },
        net: { value: 125.5, currency: 'USD' },
      },
    ],
    total: { value: 125.5, currency: 'USD' },
  } as Claim,
  patient: {
    resourceType: 'Patient',
    name: [{ given: ['Jane'], family: 'Doe' }],
    birthDate: '1990-01-01',
    gender: 'female',
    address: [{ line: ['1 Main St'], city: 'Oakland', state: 'CA', postalCode: '94601' }],
  },
  coverages: [
    {
      resourceType: 'Coverage',
      id: 'cov-primary',
      status: 'active',
      beneficiary: { reference: 'Patient/p1' },
      subscriber: { reference: 'RelatedPerson/rp-1' },
      subscriberId: 'MEM-123',
      payor: [{ reference: getPayerUrl('123456') }],
    },
    {
      resourceType: 'Coverage',
      id: 'cov-secondary',
      status: 'active',
      beneficiary: { reference: 'Patient/p1' },
      subscriberId: 'MEM-456',
      payor: [{ reference: getPayerUrl('222222') }],
    },
  ],
  renderingProvider: {
    resourceType: 'Practitioner',
    name: [{ family: 'Smith' }],
    identifier: [{ system: FHIR_IDENTIFIER_NPI, value: '1234567890' }],
  },
  billingProvider: {
    resourceType: 'Organization',
    name: 'Acme Medical Group',
    identifier: [{ system: FHIR_IDENTIFIER_NPI, value: '8888888888' }],
  },
  serviceFacility: {
    resourceType: 'Location',
    name: 'Main Clinic',
    address: { state: 'CA' },
    identifier: [{ system: FHIR_IDENTIFIER_NPI, value: '9999999999' }],
  },
  subscribers: [
    {
      resourceType: 'RelatedPerson',
      id: 'rp-1',
      patient: { reference: 'Patient/p1' },
      name: [{ given: ['Pat'], family: 'Holder' }],
      birthDate: '1980-05-05',
      gender: 'male',
    },
  ],
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

  it('compares numerically when both sides are numbers, lexicographically for ISO dates', () => {
    // Numeric: "9" > "100" as strings but not as numbers.
    expect(evaluateOperator('gt', '9', '100')).toBe(false);
    expect(evaluateOperator('gt', '125.5', '100')).toBe(true);
    expect(evaluateOperator('gte', '100', '100')).toBe(true);
    expect(evaluateOperator('lt', '99.99', '100')).toBe(true);
    expect(evaluateOperator('lte', '100', '100')).toBe(true);
    expect(evaluateOperator('lte', '100.01', '100')).toBe(false);
    // Dates: ISO strings order chronologically.
    expect(evaluateOperator('lt', '2005-12-31', '2008-07-14')).toBe(true);
    expect(evaluateOperator('gt', '2026-01-05', '2025-12-31')).toBe(true);
    expect(evaluateOperator('gte', '2026-01-05', '2026-01-05')).toBe(true);
    // Missing/empty values never satisfy a comparison.
    expect(evaluateOperator('gt', undefined, '100')).toBe(false);
    expect(evaluateOperator('lt', undefined, '100')).toBe(false);
    expect(evaluateOperator('lte', '', '100')).toBe(false);
    expect(evaluateOperator('gt', '100', undefined)).toBe(false);
  });

  it('reads logical fields that span resources', () => {
    const m = makeModel();
    expect(readField(m, 'payerId')).toBe('123456');
    expect(readField(m, 'patient.birthDate')).toBe('1990-01-01');
    expect(readField(m, 'serviceFacility.state')).toBe('CA');
    expect(readField(m, 'renderingProvider.npi')).toBe('1234567890');
    expect(readField(m, 'tags')).toEqual([]);
  });

  it('reads the claim-level fields (type, dates, amounts, code lists, billing type)', () => {
    const m = makeModel();
    expect(readField(m, 'type')).toBe('professional');
    expect(readField(m, 'created')).toBe('2026-01-01');
    expect(readField(m, 'serviceDate')).toBe('2026-01-05');
    expect(readField(m, 'billed')).toBe('125.5');
    expect(readField(m, 'billingType')).toBe('Insurance Pay');
    expect(readField(m, 'billableStatus')).toBe('Billable');
    expect(readField(m, 'diagnosisCodes')).toEqual(['J06.9']);
    expect(readField(m, 'cptCodes')).toEqual(['99213']);
    expect(readField(m, 'placeOfServiceCodes')).toEqual(['20']);
  });

  it('reads insurance, policy holder, secondary insurance, and billing provider fields', () => {
    const m = makeModel();
    expect(readField(m, 'insurance.memberId')).toBe('MEM-123');
    expect(readField(m, 'insurance.status')).toBe('active');
    expect(readField(m, 'policyHolder.firstName')).toBe('Pat');
    expect(readField(m, 'policyHolder.birthDate')).toBe('1980-05-05');
    expect(readField(m, 'secondaryInsurance.payerId')).toBe('222222');
    expect(readField(m, 'secondaryInsurance.memberId')).toBe('MEM-456');
    expect(readField(m, 'billingProvider.lastName')).toBe('Acme Medical Group');
    expect(readField(m, 'billingProvider.npi')).toBe('8888888888');
    expect(readField(m, 'patient.city')).toBe('Oakland');
    expect(readField(m, 'patient.addressLine1')).toBe('1 Main St');
  });

  it('writes claim status fields with validation and AR-stage initialization', () => {
    const m = makeModel();
    expect(readField(m, 'status.arStage')).toBeUndefined();
    expect(writeField(m, 'status.arStage', 'insurance-payer-ar')).toBe(true);
    expect(readField(m, 'status.arStage')).toBe('insurance-payer-ar');
    // Entering an AR stage initializes that stage's progress status, like the claim screens do.
    expect(readField(m, 'status.insuranceArStatus')).toBe('created');
    // Invalid codes are rejected (the engine will hold the claim).
    expect(writeField(m, 'status.adjudicationStatus', 'not-a-real-code')).toBe(false);
    expect(writeField(m, 'status.adjudicationStatus', 'denied')).toBe(true);
    // Clearing back to None removes the tag.
    expect(writeField(m, 'status.adjudicationStatus', null)).toBe(true);
    expect(readField(m, 'status.adjudicationStatus')).toBeUndefined();
  });

  it('writes claim type, service category, and service date', () => {
    const m = makeModel();
    expect(writeField(m, 'type', 'institutional')).toBe(true);
    expect(readField(m, 'type')).toBe('institutional');
    expect(writeField(m, 'type', 'dental')).toBe(false);

    expect(writeField(m, 'service', 'urgent-care')).toBe(true);
    expect(readField(m, 'service')).toBe('urgent-care');

    expect(writeField(m, 'serviceDate', '2026-02-02')).toBe(true);
    expect(readField(m, 'serviceDate')).toBe('2026-02-02');
    expect(m.claim.item?.[0]?.servicedPeriod?.start).toBe('2026-02-02');
    // A claim with no service lines has nothing to date — the write must fail, not no-op.
    m.claim.item = [];
    expect(writeField(m, 'serviceDate', '2026-02-02')).toBe(false);
  });

  it('writes coverage fields (member id, status, plan type) and the secondary payer', () => {
    const m = makeModel();
    expect(writeField(m, 'insurance.memberId', 'NEW-MEM')).toBe(true);
    expect(m.coverages[0].subscriberId).toBe('NEW-MEM');
    expect(writeField(m, 'insurance.status', 'cancelled')).toBe(true);
    expect(writeField(m, 'insurance.status', 'bogus')).toBe(false);
    expect(writeField(m, 'insurance.planType', '12')).toBe(true);
    expect(readField(m, 'insurance.planType')).toBe('12');
    expect(writeField(m, 'insurance.planType', 'not-a-plan-type')).toBe(false);

    expect(writeField(m, 'secondaryInsurance.payerId', '333333')).toBe(true);
    expect(m.coverages[1].payor?.[0]?.reference).toContain('333333');
    // The primary payer and the claim's insurer are untouched by a secondary payer change.
    expect(readField(m, 'payerId')).toBe('123456');
  });

  it('writes policy holder fields on the subscriber working copy, failing when there is none', () => {
    const m = makeModel();
    expect(writeField(m, 'policyHolder.lastName', 'Newname')).toBe(true);
    expect(m.subscribers[0].name?.[0]?.family).toBe('Newname');
    expect(writeField(m, 'policyHolder.addressLine1', '2 Elm St')).toBe(true);
    expect(readField(m, 'policyHolder.addressLine1')).toBe('2 Elm St');

    // Self-subscribed coverage (no RelatedPerson): the target is missing, so the write fails.
    m.coverages[0].subscriber = { reference: 'Patient/p1' };
    expect(writeField(m, 'policyHolder.lastName', 'X')).toBe(false);
  });

  it('writes provider and facility detail fields', () => {
    const m = makeModel();
    // First name only applies to individual providers; the billing provider is an organization.
    expect(writeField(m, 'renderingProvider.firstName', 'Sam')).toBe(true);
    expect(readField(m, 'renderingProvider.firstName')).toBe('Sam');
    expect(writeField(m, 'billingProvider.firstName', 'Sam')).toBe(false);

    expect(writeField(m, 'billingProvider.taxId', '12-3456789')).toBe(true);
    expect(readField(m, 'billingProvider.taxId')).toBe('12-3456789');
    expect(writeField(m, 'renderingProvider.taxonomy', '207Q00000X')).toBe(true);
    expect(readField(m, 'renderingProvider.taxonomy')).toBe('207Q00000X');

    expect(writeField(m, 'serviceFacility.posCode', '11')).toBe(true);
    expect(readField(m, 'serviceFacility.posCode')).toBe('11');
    expect(writeField(m, 'serviceFacility.clia', '05D1234567')).toBe(true);
    expect(readField(m, 'serviceFacility.clia')).toBe('05D1234567');
    expect(writeField(m, 'serviceFacility.addressLine1', '500 Care Way')).toBe(true);
    expect(writeField(m, 'serviceFacility.zip', '94123')).toBe(true);
    expect(readField(m, 'serviceFacility.addressLine1')).toBe('500 Care Way');
    expect(readField(m, 'serviceFacility.zip')).toBe('94123');
  });

  it('preserves the middle name when writing the first name, and vice versa', () => {
    const m = makeModel();
    expect(writeField(m, 'patient.middleName', 'Q')).toBe(true);
    expect(writeField(m, 'patient.firstName', 'Janet')).toBe(true);
    expect(m.patient?.name?.[0]?.given).toEqual(['Janet', 'Q']);
    expect(readField(m, 'patient.middleName')).toBe('Q');
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
