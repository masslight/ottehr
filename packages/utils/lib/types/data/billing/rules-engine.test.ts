import { describe, expect, it } from 'vitest';
import { HOLD_TAG_NAME } from './rules-engine.constants';
import {
  ADD_SERVICE_LINE_FIELDS,
  addServiceLineFieldProblem,
  collectApplyTagNames,
  collectSetResourceRefs,
  getRuleFieldDef,
  getServiceLinePropertyDef,
  PATIENT_COVERAGE_FIELD_ID,
  ruleConditionValueProblem,
  RuleFieldDef,
  ruleReferencesPatientCoverage,
  ruleUsesChargeMasterPrices,
  serviceLineMatchValueProblem,
  serviceLineSetValueProblem,
  setFieldValueProblem,
  validateRuleFieldReferences,
} from './rules-engine.field-catalog';
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

  it('parses applyChargeMasterPrices actions with all/field matches, requiring the match', () => {
    const priceAll = { type: 'applyChargeMasterPrices', match: { type: 'all' } };
    expect(RuleActionSchema.parse(priceAll)).toEqual(priceAll);

    const priceOne = {
      type: 'applyChargeMasterPrices',
      match: { type: 'field', property: 'cptCode', operator: 'eq', value: '99213' },
    };
    expect(RuleActionSchema.parse(priceOne)).toEqual(priceOne);

    expect(RuleActionSchema.safeParse({ type: 'applyChargeMasterPrices' }).success).toBe(false);
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

describe('rule value validation', () => {
  const field = (id: string): RuleFieldDef => {
    const def = getRuleFieldDef(id);
    if (!def) throw new Error(`unknown field ${id}`);
    return def;
  };

  it('validates condition values with operator awareness', () => {
    const state = field('patient.state');
    expect(ruleConditionValueProblem(state, 'eq', 'CA')).toBeUndefined();
    expect(ruleConditionValueProblem(state, 'eq', 'XX')).toContain('one of the listed options');
    expect(ruleConditionValueProblem(state, 'exists', undefined)).toBeUndefined();
    expect(ruleConditionValueProblem(state, 'in', ['CA', 'OR'])).toBeUndefined();
    expect(ruleConditionValueProblem(state, 'in', ['CA', 'XX'])).toContain('one of the listed options');
    expect(ruleConditionValueProblem(state, 'eq', '')).toBe('Value is required');
    expect(ruleConditionValueProblem(state, 'in', [])).toBe('Value is required');

    const npi = field('renderingProvider.npi');
    expect(ruleConditionValueProblem(npi, 'eq', '1234567893')).toBeUndefined();
    expect(ruleConditionValueProblem(npi, 'eq', '1234567890')).toContain('check digit');
    // Fragment operators legitimately take partial values.
    expect(ruleConditionValueProblem(npi, 'startsWith', '123')).toBeUndefined();
    expect(ruleConditionValueProblem(npi, 'startsWith', '')).toBe('Value is required');

    const dob = field('patient.birthDate');
    expect(ruleConditionValueProblem(dob, 'lt', '2008-01-01')).toBeUndefined();
    expect(ruleConditionValueProblem(dob, 'lt', '01/01/2008')).toContain('ISO date');

    const billed = field('billed');
    expect(ruleConditionValueProblem(billed, 'gt', '100.5')).toBeUndefined();
    expect(ruleConditionValueProblem(billed, 'gt', 'lots')).toContain('number');
  });

  it('validates setField values with clear-vs-required semantics', () => {
    expect(setFieldValueProblem(field('patient.state'), '')).toBeUndefined(); // clear is legal
    expect(setFieldValueProblem(field('patient.state'), 'CA')).toBeUndefined();
    expect(setFieldValueProblem(field('patient.state'), 'XX')).toContain('one of the listed options');
    expect(setFieldValueProblem(field('payerId'), '')).toBe('Value is required'); // requiredOnSet
    expect(setFieldValueProblem(field('payerId'), null)).toBe('Value is required');
    expect(setFieldValueProblem(field('billingProvider.taxId'), '12-3456789')).toContain('9 digits');
    expect(setFieldValueProblem(field('billingProvider.taxId'), '123456789')).toBeUndefined();
    expect(setFieldValueProblem(field('serviceFacility.clia'), '05D1234567')).toBeUndefined();
    expect(setFieldValueProblem(field('serviceFacility.clia'), '05d1234567')).toContain('NNDNNNNNNN');
    expect(setFieldValueProblem(field('patient.zip'), '94103')).toBeUndefined();
    expect(setFieldValueProblem(field('patient.zip'), '9410')).toContain('ZIP');
    expect(setFieldValueProblem(field('renderingProvider.taxonomy'), '207Q00000X')).toBeUndefined();
    expect(setFieldValueProblem(field('renderingProvider.taxonomy'), '207Q')).toContain('10 characters');
    expect(setFieldValueProblem(field('serviceDate'), '')).toBe('Value is required');
    expect(setFieldValueProblem(field('serviceDate'), '2026-02-02')).toBeUndefined();
  });

  it('rejects a list value under a single-value operator (stale "is one of" leftovers)', () => {
    const state = field('patient.state');
    // The evaluator would silently compare only the first entry — save-time must reject instead.
    expect(ruleConditionValueProblem(state, 'eq', ['CA', 'TX'])).toContain('single value');
    expect(ruleConditionValueProblem(state, 'in', ['CA', 'TX'])).toBeUndefined();

    const pos = getServiceLinePropertyDef('placeOfService');
    if (!pos) throw new Error('missing placeOfService def');
    expect(serviceLineMatchValueProblem(pos, 'eq', ['11', '12'])).toContain('single value');
    expect(serviceLineMatchValueProblem(pos, 'in', ['11', '12'])).toBeUndefined();
  });

  it('validates service line match and set values', () => {
    const pos = getServiceLinePropertyDef('placeOfService');
    const units = getServiceLinePropertyDef('units');
    const charges = getServiceLinePropertyDef('charges');
    const modifiers = getServiceLinePropertyDef('modifiers');
    const lineDate = getServiceLinePropertyDef('serviceDate');
    if (!pos || !units || !charges || !modifiers || !lineDate) throw new Error('missing line property defs');

    expect(serviceLineMatchValueProblem(pos, 'eq', '11')).toBeUndefined();
    expect(serviceLineMatchValueProblem(pos, 'eq', '99x')).toContain('one of the listed options');
    expect(serviceLineMatchValueProblem(modifiers, 'contains', '25')).toBeUndefined();
    expect(serviceLineMatchValueProblem(modifiers, 'contains', '')).toBe('Value is required');
    expect(serviceLineMatchValueProblem(units, 'gt', 'many')).toContain('number');

    expect(serviceLineSetValueProblem(units, undefined, '2')).toBeUndefined();
    expect(serviceLineSetValueProblem(units, undefined, '0')).toContain('positive');
    expect(serviceLineSetValueProblem(units, undefined, '')).toBe('Value is required');
    expect(serviceLineSetValueProblem(charges, undefined, '-1')).toContain('non-negative');
    expect(serviceLineSetValueProblem(pos, undefined, '')).toBeUndefined(); // clearable
    expect(serviceLineSetValueProblem(pos, undefined, '99x')).toContain('one of the listed options');
    expect(serviceLineSetValueProblem(lineDate, undefined, '')).toBe('Value is required');
    expect(serviceLineSetValueProblem(lineDate, undefined, '02/02/2026')).toContain('ISO');
    expect(serviceLineSetValueProblem(modifiers, 'add', '')).toBe('Value is required');
    expect(serviceLineSetValueProblem(modifiers, undefined, '')).toBeUndefined(); // "set" clears
  });

  it('validates add-line place of service and service date formats', () => {
    expect(addServiceLineFieldProblem('placeOfService', '11')).toBeUndefined();
    expect(addServiceLineFieldProblem('placeOfService', '00')).toBe('Unknown place of service code');
    expect(addServiceLineFieldProblem('placeOfService', '')).toBeUndefined();
    expect(addServiceLineFieldProblem('serviceDate', '2026-02-02')).toBeUndefined();
    expect(addServiceLineFieldProblem('serviceDate', '02/02/2026')).toContain('ISO date');
  });

  it('collects applyTag names across nested conditionals', () => {
    const names = collectApplyTagNames({
      conditional: {
        branches: [
          {
            condition: { type: 'all' },
            outcome: {
              type: 'conditional',
              conditional: {
                branches: [
                  {
                    condition: { type: 'all' },
                    outcome: { type: 'actions', actions: [{ type: 'applyTag', tag: 'VIP' }] },
                  },
                ],
                otherwise: { type: 'actions', actions: [{ type: 'applyTag', tag: HOLD_TAG_NAME }] },
              },
            },
          },
          {
            condition: { type: 'all' },
            outcome: {
              type: 'actions',
              actions: [
                { type: 'applyTag', tag: 'VIP' },
                { type: 'setField', field: 'patient.state', value: 'CA' },
              ],
            },
          },
        ],
      },
    });
    expect(names).toEqual(['VIP', HOLD_TAG_NAME]);
  });

  it('validates provider/facility reference values against their Type/id encoding', () => {
    const billingRef = field('billingProvider.ref');
    const facilityRef = field('serviceFacility.ref');
    expect(field('renderingProvider.ref').providerRole).toBe('rendering');
    expect(billingRef.providerRole).toBe('billing');

    expect(setFieldValueProblem(billingRef, 'Organization/org-1')).toBeUndefined();
    expect(setFieldValueProblem(billingRef, 'Practitioner/abc.def-123')).toBeUndefined();
    expect(setFieldValueProblem(billingRef, 'org-1')).toContain('provider reference');
    expect(setFieldValueProblem(billingRef, 'Location/loc-1')).toContain('provider reference');
    expect(setFieldValueProblem(billingRef, '')).toBe('Value is required'); // requiredOnSet — no "clear provider"
    expect(setFieldValueProblem(facilityRef, 'Location/loc-1')).toBeUndefined();
    expect(setFieldValueProblem(facilityRef, 'Practitioner/abc')).toContain('facility reference');

    // Conditions compare the same encoding (the copy's source-resource reference).
    expect(ruleConditionValueProblem(billingRef, 'eq', 'Organization/org-1')).toBeUndefined();
    expect(ruleConditionValueProblem(billingRef, 'in', ['Organization/org-1', 'nope'])).toContain('provider reference');
    expect(ruleConditionValueProblem(facilityRef, 'exists', undefined)).toBeUndefined();
  });

  it('collects setField provider/facility refs across nested conditionals, deduped', () => {
    const refs = collectSetResourceRefs({
      conditional: {
        branches: [
          {
            condition: { type: 'all' },
            outcome: {
              type: 'conditional',
              conditional: {
                branches: [
                  {
                    condition: { type: 'all' },
                    outcome: {
                      type: 'actions',
                      actions: [
                        { type: 'setField', field: 'billingProvider.ref', value: 'Organization/org-1' },
                        // Non-reference setFields are not collected.
                        { type: 'setField', field: 'patient.state', value: 'CA' },
                      ],
                    },
                  },
                ],
                otherwise: {
                  type: 'actions',
                  actions: [{ type: 'setField', field: 'serviceFacility.ref', value: 'Location/loc-1' }],
                },
              },
            },
          },
          {
            condition: { type: 'all' },
            outcome: {
              type: 'actions',
              actions: [{ type: 'setField', field: 'billingProvider.ref', value: 'Organization/org-1' }],
            },
          },
        ],
      },
    });
    expect(refs).toEqual([
      { field: 'billingProvider.ref', ref: 'Organization/org-1' },
      { field: 'serviceFacility.ref', ref: 'Location/loc-1' },
    ]);
  });

  it('detects applyChargeMasterPrices actions anywhere in the conditional tree', () => {
    expect(
      ruleUsesChargeMasterPrices({
        conditional: {
          branches: [
            {
              condition: { type: 'all' },
              outcome: {
                type: 'conditional',
                conditional: {
                  branches: [{ condition: { type: 'all' }, outcome: { type: 'noop' } }],
                  otherwise: {
                    type: 'actions',
                    actions: [{ type: 'applyChargeMasterPrices', match: { type: 'all' } }],
                  },
                },
              },
            },
          ],
        },
      })
    ).toBe(true);
    expect(
      ruleUsesChargeMasterPrices({
        conditional: {
          branches: [
            {
              condition: { type: 'all' },
              outcome: { type: 'actions', actions: [{ type: 'applyTag', tag: 'VIP' }] },
            },
          ],
        },
      })
    ).toBe(false);
  });

  it('detects the "Coverage (from patient)" field in nested conditions and setField actions', () => {
    // A condition inside a nested group references the field.
    expect(
      ruleReferencesPatientCoverage({
        conditional: {
          branches: [
            {
              condition: {
                type: 'group',
                logic: 'and',
                conditions: [
                  { type: 'field', field: 'payerId', operator: 'eq', value: '123456' },
                  { type: 'field', field: PATIENT_COVERAGE_FIELD_ID, operator: 'notExists' },
                ],
              },
              outcome: { type: 'noop' },
            },
          ],
        },
      })
    ).toBe(true);
    // A setField action inside a nested conditional's otherwise references the field.
    expect(
      ruleReferencesPatientCoverage({
        conditional: {
          branches: [
            {
              condition: { type: 'all' },
              outcome: {
                type: 'conditional',
                conditional: {
                  branches: [{ condition: { type: 'all' }, outcome: { type: 'noop' } }],
                  otherwise: {
                    type: 'actions',
                    actions: [{ type: 'setField', field: PATIENT_COVERAGE_FIELD_ID, value: 'workersComp' }],
                  },
                },
              },
            },
          ],
        },
      })
    ).toBe(true);
    // Other fields don't trigger the prefetch.
    expect(
      ruleReferencesPatientCoverage({
        conditional: {
          branches: [
            {
              condition: { type: 'field', field: 'insurance.memberId', operator: 'exists' },
              outcome: { type: 'actions', actions: [{ type: 'setField', field: 'insurance.memberId', value: 'X' }] },
            },
          ],
        },
      })
    ).toBe(false);
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

  it('reports malformed provider/facility references and unsupported ref operators', () => {
    const problems = validateRuleFieldReferences(
      ruleWith({
        branches: [
          {
            // ENUM_OPS only — fragment matching an opaque reference is meaningless.
            condition: { type: 'field', field: 'billingProvider.ref', operator: 'contains', value: 'Organization' },
            outcome: {
              type: 'actions',
              actions: [{ type: 'setField', field: 'serviceFacility.ref', value: 'loc-1' }],
            },
          },
        ],
      })
    );
    expect(problems).toHaveLength(2);
    expect(problems[0]).toContain('unsupported operator "contains"');
    expect(problems[1]).toContain('sets "serviceFacility.ref" to an invalid value');
    expect(problems[1]).toContain('facility reference');
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

  it('validates the applyChargeMasterPrices line match like the other service-line actions', () => {
    expect(
      validateRuleFieldReferences(
        ruleWith({
          branches: [
            {
              condition: { type: 'all' },
              outcome: {
                type: 'actions',
                actions: [
                  { type: 'applyChargeMasterPrices', match: { type: 'all' } },
                  {
                    type: 'applyChargeMasterPrices',
                    match: { type: 'field', property: 'cptCode', operator: 'eq', value: '99213' },
                  },
                ],
              },
            },
          ],
        })
      )
    ).toEqual([]);

    const problems = validateRuleFieldReferences(
      ruleWith({
        branches: [
          {
            condition: { type: 'all' },
            outcome: {
              type: 'actions',
              actions: [
                {
                  type: 'applyChargeMasterPrices',
                  match: { type: 'field', property: 'notALineProperty', operator: 'eq', value: 'x' },
                },
              ],
            },
          },
        ],
      })
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('matches service lines on unknown property "notALineProperty"');
  });

  it('reports unsupported condition operators and invalid condition/action values', () => {
    const problems = validateRuleFieldReferences(
      ruleWith({
        branches: [
          {
            condition: {
              type: 'group',
              logic: 'and',
              conditions: [
                // state became a select field: fragment operators are no longer offered for it.
                { type: 'field', field: 'patient.state', operator: 'contains', value: 'C' },
                { type: 'field', field: 'renderingProvider.npi', operator: 'eq', value: '1234567890' },
                { type: 'field', field: 'payerId', operator: 'eq', value: '' },
              ],
            },
            outcome: {
              type: 'actions',
              actions: [
                { type: 'setField', field: 'billingProvider.taxId', value: '12-3456789' },
                { type: 'setField', field: 'payerId', value: '' },
                {
                  type: 'updateServiceLines',
                  match: { type: 'all' },
                  set: { property: 'serviceDate', value: '02/02/2026' },
                },
              ],
            },
          },
        ],
      })
    );
    expect(problems).toHaveLength(6);
    expect(problems[0]).toContain('condition on "patient.state" with unsupported operator "contains"');
    expect(problems[1]).toContain('condition on "renderingProvider.npi" with an invalid value');
    expect(problems[2]).toContain('condition on "payerId" with an invalid value: Value is required');
    expect(problems[3]).toContain('sets "billingProvider.taxId" to an invalid value');
    expect(problems[4]).toContain('sets "payerId" to an invalid value: Value is required');
    expect(problems[5]).toContain('updates service line property "serviceDate" with an invalid value');
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
