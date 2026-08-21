import {
  Basic,
  ChargeItemDefinition,
  Claim,
  Coverage,
  Location,
  Organization,
  Practitioner,
  RelatedPerson,
} from 'fhir/r4b';
import { CPT_CODE_SYSTEM, FHIR_IDENTIFIER_NPI } from 'utils/lib/fhir/constants';
import { getPayerUrl } from 'utils/lib/helpers/helpers';
import { EXTENSION_URL_CPT_MODIFIER } from 'utils/lib/helpers/rcm/constants';
import { CLAIM_TAG_SYSTEM } from 'utils/lib/types/data/billing/billing.constants';
import { BillingInsuranceType } from 'utils/lib/types/data/billing/billing.schemas';
import { RULES_ENGINE_TYPES } from 'utils/lib/types/data/billing/rules-engine.constants';
import {
  RULE_FIELD_CATALOG,
  SERVICE_LINE_PROPERTY_CATALOG,
} from 'utils/lib/types/data/billing/rules-engine.field-catalog';
import { BillingRule } from 'utils/lib/types/data/billing/rules-engine.schemas';
import { HOLD_TAG_NAME } from 'utils/lib/types/data/billing/system-tags';
import { describe, expect, it } from 'vitest';
import {
  READABLE_FIELD_IDS,
  readField,
  readServiceLineProperty,
  RulesEngineClaimModel,
  SERVICE_LINE_READABLE_PROPERTY_IDS,
  SERVICE_LINE_WRITABLE_PROPERTY_IDS,
  WRITABLE_FIELD_IDS,
  writeField,
} from '../../../src/billing/rules-engine/claim-model';
import {
  RULE_DEFINITION_EXTENSION_URL,
  RULES_ENGINE_FHIR,
  RULES_ENGINE_TAG_SYSTEM,
  RULES_ENGINE_TASK_SYSTEM,
  rulesEngineForTaskCode,
} from '../../../src/billing/rules-engine/constants';
import {
  applyAction,
  evaluateCondition,
  evaluateOperator,
  executeRule,
} from '../../../src/billing/rules-engine/evaluator';
import {
  buildRulesEngineKickoffTask,
  listToRules,
  RULES_ENGINE_INPUT_SKIP_RULES_CODE,
  RULES_ENGINE_INPUT_SYSTEM,
  rulesToList,
} from '../../../src/billing/rules-engine/serialization';
import {
  BILLING_WORKING_COPY_TAG,
  buildNoCoverageStub,
  CHARGE_ITEM_DEFINITION_DEFAULT_SYSTEM,
  EXTENSION_CLAIM_ADMISSION_TYPE_CODE,
  EXTENSION_CLAIM_FACILITY_TYPE_CODE,
  EXTENSION_CLAIM_FREQUENCY_CODE,
  EXTENSION_CLAIM_PATIENT_DISCHARGE_STATUS,
  EXTENSION_CLAIM_POINT_OF_ORIGIN_CODE,
  PROVIDER_ROLE_TAG,
  SOURCE_IDENTIFIER_SYSTEM,
} from '../../../src/billing/shared';

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
    extension: [
      {
        url: EXTENSION_CLAIM_FACILITY_TYPE_CODE,
        valueString: '79',
      },
      {
        url: EXTENSION_CLAIM_FREQUENCY_CODE,
        valueString: '1',
      },
      {
        url: EXTENSION_CLAIM_PATIENT_DISCHARGE_STATUS,
        valueString: '12',
      },
      {
        url: EXTENSION_CLAIM_ADMISSION_TYPE_CODE,
        valueString: '3',
      },
      {
        url: EXTENSION_CLAIM_POINT_OF_ORIGIN_CODE,
        valueString: '4',
      },
    ],
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

  it('every service line property has a reader, and exactly the settable ones have writers', () => {
    const propertyIds = SERVICE_LINE_PROPERTY_CATALOG.map((p) => p.id);
    expect([...SERVICE_LINE_READABLE_PROPERTY_IDS].sort()).toEqual([...propertyIds].sort());
    const settableIds = SERVICE_LINE_PROPERTY_CATALOG.filter((p) => p.settable).map((p) => p.id);
    expect([...SERVICE_LINE_WRITABLE_PROPERTY_IDS].sort()).toEqual([...settableIds].sort());
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

  it('matches string prefixes with startsWith / notStartsWith', () => {
    expect(evaluateOperator('startsWith', 'XKD-4451', 'XKD')).toBe(true);
    expect(evaluateOperator('startsWith', 'AXKD-4451', 'XKD')).toBe(false);
    expect(evaluateOperator('notStartsWith', 'AXKD-4451', 'XKD')).toBe(true);
    expect(evaluateOperator('notStartsWith', 'XKD-4451', 'XKD')).toBe(false);
    // Prefix matching is for text values: lists and missing values never start with anything.
    expect(evaluateOperator('startsWith', ['XKD-1'], 'XKD')).toBe(false);
    expect(evaluateOperator('startsWith', undefined, 'XKD')).toBe(false);
    expect(evaluateOperator('startsWith', 'XKD-4451', undefined)).toBe(false);
    expect(evaluateOperator('notStartsWith', undefined, 'XKD')).toBe(true);
  });

  it('matches regex patterns with matches / notMatches', () => {
    // Standard (unanchored) semantics: the pattern may match anywhere unless the author anchors it.
    expect(evaluateOperator('matches', '99381', '9938')).toBe(true);
    expect(evaluateOperator('matches', '199381', '^9938[1-7]$')).toBe(false);
    expect(evaluateOperator('matches', '99381', '^9938[1-7]$')).toBe(true);
    expect(evaluateOperator('matches', '99388', '^9938[1-7]$')).toBe(false);
    expect(evaluateOperator('notMatches', '99388', '^9938[1-7]$')).toBe(true);
    // A list matches when any entry does; notMatches means no entry does.
    expect(evaluateOperator('matches', ['99213', '99385'], '^9938[1-7]$')).toBe(true);
    expect(evaluateOperator('notMatches', ['99213', '99385'], '^9938[1-7]$')).toBe(false);
    expect(evaluateOperator('notMatches', ['99213', '87880'], '^9938[1-7]$')).toBe(true);
    // Missing values never match; notMatches is true for them (like neq/notContains).
    expect(evaluateOperator('matches', undefined, '^9938')).toBe(false);
    expect(evaluateOperator('notMatches', undefined, '^9938')).toBe(true);
    expect(evaluateOperator('matches', '99381', undefined)).toBe(false);
    // An uncompilable pattern (kept out by save-time validation) evaluates as no-match, not a throw.
    expect(evaluateOperator('matches', '99381', '9938[1-7')).toBe(false);
    expect(evaluateOperator('notMatches', '99381', '9938[1-7')).toBe(true);
  });

  it('evaluates the canonical "a CPT code in the 9938x range" condition', () => {
    const m = makeModel();
    expect(
      evaluateCondition({ type: 'field', field: 'cptCodes', operator: 'matches', value: '^992[01][0-9]$' }, m)
    ).toBe(true);
    expect(evaluateCondition({ type: 'field', field: 'cptCodes', operator: 'matches', value: '^9938[1-7]$' }, m)).toBe(
      false
    );
    expect(
      evaluateCondition({ type: 'field', field: 'cptCodes', operator: 'notMatches', value: '^9938[1-7]$' }, m)
    ).toBe(true);
  });

  it('evaluates the canonical "member id starts with XKD" condition', () => {
    const m = makeModel();
    m.coverages[0].subscriberId = 'XKD-889-12';
    expect(
      evaluateCondition({ type: 'field', field: 'insurance.memberId', operator: 'startsWith', value: 'XKD' }, m)
    ).toBe(true);
    expect(
      evaluateCondition({ type: 'field', field: 'insurance.memberId', operator: 'startsWith', value: 'ZZZ' }, m)
    ).toBe(false);
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

  it('eq/neq/in/notIn compare numerically for number-typed properties only', () => {
    // Amounts: readers normalize ('125.5') while rule values keep the author's formatting ('125.50').
    expect(evaluateOperator('eq', '100', '100.00', { numeric: true })).toBe(true);
    expect(evaluateOperator('neq', '100', '100.00', { numeric: true })).toBe(false);
    expect(evaluateOperator('in', '30.5', ['20', '30.50'], { numeric: true })).toBe(true);
    expect(evaluateOperator('notIn', '30.5', ['20', '30.50'], { numeric: true })).toBe(false);
    // Ids stay exact strings even when they parse as numbers: member id '00123' is not '123'.
    expect(evaluateOperator('eq', '00123', '123')).toBe(false);
    expect(evaluateOperator('eq', '100', '100.00')).toBe(false);
    // The numeric flag never weakens empty/missing semantics ('' is not 0).
    expect(evaluateOperator('eq', '', '0', { numeric: true })).toBe(false);
    expect(evaluateOperator('eq', '0', '', { numeric: true })).toBe(false);

    // End to end: evaluateCondition passes the flag for the number-typed billed amount.
    const m = makeModel();
    expect(readField(m, 'billed')).toBe('125.5');
    expect(evaluateCondition({ type: 'field', field: 'billed', operator: 'eq', value: '125.50' }, m)).toBe(true);
    expect(evaluateCondition({ type: 'field', field: 'insurance.memberId', operator: 'eq', value: 'MEM-123' }, m)).toBe(
      true
    );
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
    expect(readField(m, 'diagnosisCodes')).toEqual(['J06.9']);
    expect(readField(m, 'cptCodes')).toEqual(['99213']);
    expect(readField(m, 'placeOfServiceCodes')).toEqual(['20']);
    expect(readField(m, 'billType')).toBe('0791');
    expect(readField(m, 'patientDischargeStatusCode')).toBe('12');
    expect(readField(m, 'admissionType')).toBe('3');
    expect(readField(m, 'admissionSource')).toBe('4');
  });

  it('reads insurance, policy holder, secondary insurance, and billing provider fields', () => {
    const m = makeModel();
    expect(readField(m, 'insurance.memberId')).toBe('MEM-123');
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

  it('writes claim type, service category, service date and other properties', () => {
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

    expect(writeField(m, 'billType', '0782')).toBe(true);
    expect(readField(m, 'billType')).toBe('0782');

    expect(writeField(m, 'patientDischargeStatusCode', '56')).toBe(true);
    expect(readField(m, 'patientDischargeStatusCode')).toBe('56');

    expect(writeField(m, 'admissionType', '7')).toBe(true);
    expect(readField(m, 'admissionType')).toBe('7');

    expect(writeField(m, 'admissionSource', '8')).toBe(true);
    expect(readField(m, 'admissionSource')).toBe('8');
  });

  it('writes coverage fields (member id, plan type) and the secondary payer', () => {
    const m = makeModel();
    expect(writeField(m, 'insurance.memberId', 'NEW-MEM')).toBe(true);
    expect(m.coverages[0].subscriberId).toBe('NEW-MEM');
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

    expect(writeField(m, 'billingProvider.taxId', '123456789')).toBe(true);
    expect(readField(m, 'billingProvider.taxId')).toBe('123456789');
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

  it('clears provider last name and facility name to undefined, never a literal empty string', () => {
    const m = makeModel();
    expect(writeField(m, 'billingProvider.lastName', '')).toBe(true);
    expect((m.billingProvider as Organization).name).toBeUndefined();
    expect(writeField(m, 'renderingProvider.lastName', '')).toBe(true);
    expect((m.renderingProvider as Practitioner).name?.[0]?.family).toBeUndefined();
    expect(writeField(m, 'serviceFacility.name', '')).toBe(true);
    expect(m.serviceFacility?.name).toBeUndefined();
  });

  it('fails positional name/address writes that would leave a leading empty slot', () => {
    const m = makeModel();
    // A middle name with no first name would store given: ['', 'M'] — invalid FHIR.
    m.patient!.name = [{ family: 'Doe' }];
    expect(writeField(m, 'patient.middleName', 'M')).toBe(false);
    expect(m.patient?.name?.[0]?.given).toBeUndefined();

    // Clearing the first name while a middle name remains is rejected; clearing back to front works.
    m.patient!.name = [{ given: ['Jane', 'Q'], family: 'Doe' }];
    expect(writeField(m, 'patient.firstName', '')).toBe(false);
    expect(m.patient?.name?.[0]?.given).toEqual(['Jane', 'Q']);
    expect(writeField(m, 'patient.middleName', '')).toBe(true);
    expect(writeField(m, 'patient.firstName', '')).toBe(true);
    expect(m.patient?.name?.[0]?.given).toBeUndefined();

    // Same rule for address lines, on persons and the facility.
    m.patient!.address = [{ line: ['1 Main St', 'Apt 2'], city: 'Oakland' }];
    expect(writeField(m, 'patient.addressLine1', '')).toBe(false);
    expect(m.patient?.address?.[0]?.line).toEqual(['1 Main St', 'Apt 2']);
    expect(writeField(m, 'patient.addressLine2', '')).toBe(true);
    expect(writeField(m, 'patient.addressLine1', '')).toBe(true);
    expect(m.patient?.address?.[0]?.line).toBeUndefined();

    m.serviceFacility!.address = {};
    expect(writeField(m, 'serviceFacility.addressLine2', 'Suite 5')).toBe(false);
    expect(m.serviceFacility?.address?.line).toBeUndefined();
  });

  it('rejects invalid written values (the same checks save-time validation runs)', () => {
    const m = makeModel();
    expect(writeField(m, 'patient.state', 'XX')).toBe(false);
    expect(writeField(m, 'patient.state', 'CA')).toBe(true);
    expect(writeField(m, 'patient.state', null)).toBe(true); // clearing stays legal

    expect(writeField(m, 'serviceFacility.zip', '123')).toBe(false);
    expect(writeField(m, 'serviceFacility.zip', '94123-1234')).toBe(true);

    // NPI validation uses the CMS checksum, matching the provider forms.
    expect(writeField(m, 'renderingProvider.npi', '1234567890')).toBe(false);
    expect(writeField(m, 'renderingProvider.npi', '1234567893')).toBe(true);

    expect(writeField(m, 'serviceFacility.posCode', '99x')).toBe(false);
    expect(writeField(m, 'serviceFacility.posCode', '11')).toBe(true);

    expect(writeField(m, 'serviceFacility.clia', '05d1234567')).toBe(false);
    expect(writeField(m, 'serviceFacility.clia', '05D1234567')).toBe(true);

    expect(writeField(m, 'patient.birthDate', '01/01/1990')).toBe(false);
    expect(writeField(m, 'patient.birthDate', '1990-01-01')).toBe(true);
    expect(writeField(m, 'serviceDate', '02/02/2026')).toBe(false);

    expect(writeField(m, 'billingProvider.taxonomy', '207Q')).toBe(false);
    expect(writeField(m, 'billingProvider.taxId', '12-3456789')).toBe(false);
  });
});

describe('service line actions', () => {
  const addLine = (m: RulesEngineClaimModel, cptCode: string, charges = 100): void => {
    m.claim.item = [
      ...(m.claim.item ?? []),
      {
        sequence: (m.claim.item?.length ?? 0) + 1,
        productOrService: { coding: [{ code: cptCode }] },
        servicedPeriod: { start: '2026-01-05' },
        net: { value: charges, currency: 'USD' },
      },
    ];
  };

  it('updates only the lines matching the predicate ("change that line\'s CPT code")', () => {
    const m = makeModel();
    addLine(m, '99214', 200);
    const error = applyAction(
      {
        type: 'updateServiceLines',
        match: { type: 'field', property: 'cptCode', operator: 'eq', value: '99213' },
        set: { property: 'cptCode', value: '99215' },
      },
      m
    );
    expect(error).toBeUndefined();
    expect(readField(m, 'cptCodes')).toEqual(['99215', '99214']);
  });

  it('treats zero matching lines as a no-op, not a failure', () => {
    const m = makeModel();
    const before = JSON.stringify(m.claim);
    const error = applyAction(
      {
        type: 'updateServiceLines',
        match: { type: 'field', property: 'cptCode', operator: 'eq', value: '00000' },
        set: { property: 'units', value: '3' },
      },
      m
    );
    expect(error).toBeUndefined();
    expect(JSON.stringify(m.claim)).toBe(before);
  });

  it('recomputes the billed total when line charges change', () => {
    const m = makeModel();
    addLine(m, '99214', 200);
    const error = applyAction(
      { type: 'updateServiceLines', match: { type: 'all' }, set: { property: 'charges', value: '50' } },
      m
    );
    expect(error).toBeUndefined();
    expect(m.claim.total?.value).toBe(100);
    expect(readField(m, 'billed')).toBe('100');
  });

  it('stops the rule with an error when the value is invalid', () => {
    const m = makeModel();
    const rule: BillingRule = {
      id: 'r-bad-units',
      name: 'Bad units',
      description: '',
      enabled: true,
      conditional: {
        branches: [
          {
            condition: { type: 'all' },
            outcome: {
              type: 'actions',
              actions: [
                { type: 'updateServiceLines', match: { type: 'all' }, set: { property: 'units', value: 'lots' } },
                { type: 'setField', field: 'patient.lastName', value: 'ShouldNotApply' },
              ],
            },
          },
        ],
      },
    };
    const result = executeRule(rule, m);
    expect(result.error).toContain('units');
    // The run stops at the failed action; later actions must not apply.
    expect(readField(m, 'patient.lastName')).toBe('Doe');
  });

  it('adds, removes, and replaces modifiers via the set operation', () => {
    const m = makeModel();
    const modifiersOfLine = (): string | string[] | undefined => readServiceLineProperty(m.claim.item![0], 'modifiers');
    const setModifiers = (value: string, operation?: 'set' | 'add' | 'remove'): string | undefined =>
      applyAction(
        { type: 'updateServiceLines', match: { type: 'all' }, set: { property: 'modifiers', value, operation } },
        m
      );

    expect(setModifiers('25', 'add')).toBeUndefined();
    expect(modifiersOfLine()).toEqual(['25']);
    expect(setModifiers('25', 'add')).toBeUndefined(); // adding an existing modifier is a no-op
    expect(modifiersOfLine()).toEqual(['25']);
    expect(setModifiers('GT, 59')).toBeUndefined(); // default operation replaces the list
    expect(modifiersOfLine()).toEqual(['GT', '59']);
    expect(setModifiers('GT', 'remove')).toBeUndefined();
    expect(modifiersOfLine()).toEqual(['59']);
    expect(setModifiers('')).toBeUndefined(); // set to empty clears
    expect(modifiersOfLine()).toEqual([]);
    // add/remove need a modifier value; add/remove on a non-list property is rejected by the writer.
    expect(setModifiers('', 'add')).toContain('modifiers');
    expect(
      applyAction(
        {
          type: 'updateServiceLines',
          match: { type: 'all' },
          set: { property: 'units', value: '2', operation: 'add' },
        },
        m
      )
    ).toContain('units');
  });

  it('removes matching lines, re-sequences survivors, and recomputes the total', () => {
    const m = makeModel();
    addLine(m, '99214', 200);
    addLine(m, '99215', 300);
    const error = applyAction(
      { type: 'removeServiceLines', match: { type: 'field', property: 'cptCode', operator: 'eq', value: '99214' } },
      m
    );
    expect(error).toBeUndefined();
    expect(readField(m, 'cptCodes')).toEqual(['99213', '99215']);
    expect(m.claim.item?.map((line) => line.sequence)).toEqual([1, 2]);
    expect(m.claim.total?.value).toBe(425.5);
  });

  it('removes the lines whose CPT matches a regex range', () => {
    const m = makeModel();
    addLine(m, '99381', 200);
    addLine(m, '99385', 300);
    const error = applyAction(
      {
        type: 'removeServiceLines',
        match: { type: 'field', property: 'cptCode', operator: 'matches', value: '^9938[1-7]$' },
      },
      m
    );
    expect(error).toBeUndefined();
    expect(readField(m, 'cptCodes')).toEqual(['99213']);
    expect(m.claim.total?.value).toBe(125.5);
  });

  it('removes all lines when the match is "all"', () => {
    const m = makeModel();
    addLine(m, '99214', 200);
    const error = applyAction({ type: 'removeServiceLines', match: { type: 'all' } }, m);
    expect(error).toBeUndefined();
    expect(m.claim.item).toBeUndefined();
    expect(m.claim.total?.value).toBe(0);
    expect(readField(m, 'serviceLineCount')).toBe('0');
    expect(readField(m, 'cptCodes')).toEqual([]);
  });

  it('adds a service line with every field specified and recomputes the total', () => {
    const m = makeModel();
    const error = applyAction(
      {
        type: 'addServiceLine',
        line: {
          cptCode: '87880',
          modifiers: 'QW, 59',
          units: '2',
          charges: '45.25',
          placeOfService: '11',
          serviceDate: '2026-02-02',
          diagnosisPointers: '1',
        },
      },
      m
    );
    expect(error).toBeUndefined();
    expect(m.claim.item).toHaveLength(2);
    const added = m.claim.item![1];
    expect(added.sequence).toBe(2);
    expect(readServiceLineProperty(added, 'cptCode')).toBe('87880');
    expect(readServiceLineProperty(added, 'modifiers')).toEqual(['QW', '59']);
    expect(readServiceLineProperty(added, 'units')).toBe('2');
    expect(readServiceLineProperty(added, 'charges')).toBe('45.25');
    expect(readServiceLineProperty(added, 'placeOfService')).toBe('11');
    expect(readServiceLineProperty(added, 'serviceDate')).toBe('2026-02-02');
    expect(added.diagnosisSequence).toEqual([1]);
    expect(m.claim.total?.value).toBe(170.75);
    expect(readField(m, 'billed')).toBe('170.75');
  });

  it('fills the claim editor defaults for blank optional fields on an added line', () => {
    const m = makeModel();
    m.claim.careTeam = [{ sequence: 1, provider: { reference: 'Practitioner/rp' } }];
    const error = applyAction({ type: 'addServiceLine', line: { cptCode: '99050', charges: '30' } }, m);
    expect(error).toBeUndefined();
    const added = m.claim.item![1];
    expect(readServiceLineProperty(added, 'units')).toBe('1');
    // Inherited from the claim's first line.
    expect(readServiceLineProperty(added, 'serviceDate')).toBe('2026-01-05');
    // Points at the first diagnosis, and ties to the rendering provider, like the claim editor.
    expect(added.diagnosisSequence).toEqual([1]);
    expect(added.careTeamSequence).toEqual([1]);
    expect(readServiceLineProperty(added, 'modifiers')).toEqual([]);
    expect(readServiceLineProperty(added, 'placeOfService')).toBeUndefined();
  });

  it('fails adding a line without an inheritable service date or with invalid values', () => {
    const m = makeModel();
    m.claim.item = [];
    expect(applyAction({ type: 'addServiceLine', line: { cptCode: '99050', charges: '30' } }, m)).toContain(
      'service date'
    );
    expect(
      applyAction({ type: 'addServiceLine', line: { cptCode: '99050', charges: '30', serviceDate: '2026-02-02' } }, m)
    ).toBeUndefined();
    expect(m.claim.item).toHaveLength(1);
    expect(m.claim.item![0].sequence).toBe(1);
    expect(m.claim.total?.value).toBe(30);

    expect(applyAction({ type: 'addServiceLine', line: { cptCode: '99050', charges: 'abc' } }, m)).toContain('charges');
    expect(applyAction({ type: 'addServiceLine', line: { cptCode: '99050', charges: '30', units: '0' } }, m)).toContain(
      'units'
    );
    expect(
      applyAction({ type: 'addServiceLine', line: { cptCode: '99050', charges: '30', diagnosisPointers: '3' } }, m)
    ).toContain('diagnosis pointer 3');
    // The failed adds must not have appended anything.
    expect(m.claim.item).toHaveLength(1);
  });

  it('rejects invalid line place-of-service and service-date values instead of silently dropping them', () => {
    const m = makeModel();
    expect(
      applyAction(
        { type: 'updateServiceLines', match: { type: 'all' }, set: { property: 'placeOfService', value: '99x' } },
        m
      )
    ).toContain('placeOfService');
    expect(
      applyAction(
        { type: 'updateServiceLines', match: { type: 'all' }, set: { property: 'serviceDate', value: '02/02/2026' } },
        m
      )
    ).toContain('serviceDate');
    expect(
      applyAction({ type: 'addServiceLine', line: { cptCode: '99050', charges: '30', placeOfService: '99x' } }, m)
    ).toContain('place of service');
    expect(
      applyAction({ type: 'addServiceLine', line: { cptCode: '99050', charges: '30', serviceDate: '2026-2-2' } }, m)
    ).toContain('service date');
    // The failed actions must not have changed the claim's lines.
    expect(m.claim.item).toHaveLength(1);
    expect(readServiceLineProperty(m.claim.item![0], 'placeOfService')).toBe('20');
  });

  it('detects duplicate CPT codes and executes the canonical hold-on-duplicates rule', () => {
    const m = makeModel();
    expect(readField(m, 'duplicateCptCodes')).toEqual([]);
    addLine(m, '99213'); // duplicates the fixture line's code
    addLine(m, '99214');
    expect(readField(m, 'duplicateCptCodes')).toEqual(['99213']);
    expect(readField(m, 'serviceLineCount')).toBe('3');

    const rule: BillingRule = {
      id: 'r-dup',
      name: 'Hold duplicate CPT billing',
      description: '',
      enabled: true,
      conditional: {
        branches: [
          {
            condition: { type: 'field', field: 'duplicateCptCodes', operator: 'exists' },
            outcome: { type: 'actions', actions: [{ type: 'applyTag', tag: HOLD_TAG_NAME }] },
          },
        ],
      },
    };
    const result = executeRule(rule, m);
    expect(result.held).toBe(true);
    expect(claimTags(m)).toContain(HOLD_TAG_NAME);
  });
});

describe('apply charge master prices action', () => {
  const makeChargeMaster = (
    kind: 'insurance' | 'self-pay',
    date: string,
    prices: { code: string; amount: number; modifier?: string }[],
    over?: Partial<ChargeItemDefinition>
  ): ChargeItemDefinition => ({
    resourceType: 'ChargeItemDefinition',
    url: `urn:uuid:charge-master:${kind}:${date}`,
    title: `${kind} ${date}`,
    status: 'active',
    date,
    meta: { tag: [{ system: CHARGE_ITEM_DEFINITION_DEFAULT_SYSTEM, code: kind }] },
    propertyGroup: prices.map((price) => ({
      priceComponent: [
        {
          type: 'base' as const,
          code: { coding: [{ system: CPT_CODE_SYSTEM, code: price.code }] },
          amount: { value: price.amount, currency: 'USD' },
          ...(price.modifier ? { extension: [{ url: EXTENSION_URL_CPT_MODIFIER, valueCode: price.modifier }] } : {}),
        },
      ],
    })),
    ...over,
  });

  const addLine = (m: RulesEngineClaimModel, cptCode: string, charges: number, modifier?: string): void => {
    m.claim.item = [
      ...(m.claim.item ?? []),
      {
        sequence: (m.claim.item?.length ?? 0) + 1,
        productOrService: { coding: [{ code: cptCode }] },
        servicedPeriod: { start: '2026-01-05' },
        net: { value: charges, currency: 'USD' },
        ...(modifier ? { modifier: [{ coding: [{ code: modifier }] }] } : {}),
      },
    ];
  };

  const lineCharges = (m: RulesEngineClaimModel): (string | string[] | undefined)[] =>
    (m.claim.item ?? []).map((line) => readServiceLineProperty(line, 'charges'));

  it('re-prices matched lines from the insurance default (modifier-aware) and recomputes the total', () => {
    const m = makeModel(); // the fixture claim carries a real coverage -> insurance billing type
    addLine(m, '99214', 200, '25');
    m.chargeMasters = [
      makeChargeMaster('insurance', '2025-06-01', [
        { code: '99213', amount: 150 },
        { code: '99214', amount: 250, modifier: '25' },
      ]),
      makeChargeMaster('self-pay', '2025-06-01', [{ code: '99213', amount: 60 }]),
    ];
    const error = applyAction({ type: 'applyChargeMasterPrices', match: { type: 'all' } }, m);
    expect(error).toBeUndefined();
    expect(lineCharges(m)).toEqual(['150', '250']);
    expect(m.claim.total?.value).toBe(400);
  });

  it('prices only the lines matching the predicate', () => {
    const m = makeModel();
    addLine(m, '99214', 200);
    m.chargeMasters = [
      makeChargeMaster('insurance', '2025-06-01', [
        { code: '99213', amount: 150 },
        { code: '99214', amount: 250 },
      ]),
    ];
    const error = applyAction(
      {
        type: 'applyChargeMasterPrices',
        match: { type: 'field', property: 'cptCode', operator: 'eq', value: '99213' },
      },
      m
    );
    expect(error).toBeUndefined();
    expect(lineCharges(m)).toEqual(['150', '200']);
    expect(m.claim.total?.value).toBe(350);
  });

  it('selects the self-pay default when the claim carries no real coverage', () => {
    const m = makeModel();
    m.claim.insurance = [buildNoCoverageStub()];
    m.chargeMasters = [
      makeChargeMaster('insurance', '2025-06-01', [{ code: '99213', amount: 150 }]),
      makeChargeMaster('self-pay', '2025-06-01', [{ code: '99213', amount: 60 }]),
    ];
    const error = applyAction({ type: 'applyChargeMasterPrices', match: { type: 'all' } }, m);
    expect(error).toBeUndefined();
    expect(lineCharges(m)).toEqual(['60']);
  });

  it('selects the most recent charge master effective on or before the date of service', () => {
    const m = makeModel(); // fixture line's service date is 2026-01-05
    m.chargeMasters = [
      makeChargeMaster('insurance', '2025-01-01', [{ code: '99213', amount: 100 }]),
      makeChargeMaster('insurance', '2026-01-01', [{ code: '99213', amount: 120 }]),
      makeChargeMaster('insurance', '2026-02-01', [{ code: '99213', amount: 999 }]), // effective after DOS
      makeChargeMaster('insurance', '2026-01-04', [{ code: '99213', amount: 555 }], { status: 'retired' }),
    ];
    const error = applyAction({ type: 'applyChargeMasterPrices', match: { type: 'all' } }, m);
    expect(error).toBeUndefined();
    expect(lineCharges(m)).toEqual(['120']);
  });

  it('treats zero matching lines as a no-op, even with no charge masters loaded', () => {
    const m = makeModel();
    const before = JSON.stringify(m.claim);
    const error = applyAction(
      {
        type: 'applyChargeMasterPrices',
        match: { type: 'field', property: 'cptCode', operator: 'eq', value: '00000' },
      },
      m
    );
    expect(error).toBeUndefined();
    expect(JSON.stringify(m.claim)).toBe(before);
  });

  it('is a no-op when no applicable charge master exists, leaving the claim untouched', () => {
    const m = makeModel();
    const before = JSON.stringify(m.claim);
    expect(applyAction({ type: 'applyChargeMasterPrices', match: { type: 'all' } }, m)).toBeUndefined();
    // A charge master effective only after the date of service is not applicable either.
    m.chargeMasters = [makeChargeMaster('insurance', '2026-02-01', [{ code: '99213', amount: 100 }])];
    expect(applyAction({ type: 'applyChargeMasterPrices', match: { type: 'all' } }, m)).toBeUndefined();
    expect(JSON.stringify(m.claim)).toBe(before);
  });

  it('is a no-op when the claim has no date of service to select a charge master by', () => {
    const m = makeModel();
    delete m.claim.item![0].servicedPeriod;
    m.chargeMasters = [makeChargeMaster('insurance', '2025-01-01', [{ code: '99213', amount: 100 }])];
    const before = JSON.stringify(m.claim);
    expect(applyAction({ type: 'applyChargeMasterPrices', match: { type: 'all' } }, m)).toBeUndefined();
    expect(JSON.stringify(m.claim)).toBe(before);
  });

  it('prices the lines the charge master has entries for and leaves the rest unchanged', () => {
    const m = makeModel();
    addLine(m, '99999', 200); // no charge master entry for this code
    addLine(m, '99213', 90, '25'); // entry exists but only modifier-less -> no match for this line
    m.chargeMasters = [makeChargeMaster('insurance', '2025-06-01', [{ code: '99213', amount: 150 }])];
    const error = applyAction({ type: 'applyChargeMasterPrices', match: { type: 'all' } }, m);
    expect(error).toBeUndefined();
    expect(lineCharges(m)).toEqual(['150', '200', '90']);
    expect(m.claim.total?.value).toBe(440);
  });

  it('skips a matched line with no CPT code instead of failing', () => {
    const m = makeModel();
    m.claim.item = [
      ...(m.claim.item ?? []),
      {
        sequence: 2,
        productOrService: { coding: [] },
        servicedPeriod: { start: '2026-01-05' },
        net: { value: 40, currency: 'USD' },
      },
    ];
    m.chargeMasters = [makeChargeMaster('insurance', '2025-06-01', [{ code: '99213', amount: 150 }])];
    const error = applyAction({ type: 'applyChargeMasterPrices', match: { type: 'all' } }, m);
    expect(error).toBeUndefined();
    expect(lineCharges(m)).toEqual(['150', '40']);
    expect(m.claim.total?.value).toBe(190);
  });

  it('leaves the claim untouched (including the total) when no matched line has an entry', () => {
    const m = makeModel();
    addLine(m, '99999', 200); // addLine does not recompute the fixture total, so a recompute would change it
    m.chargeMasters = [makeChargeMaster('insurance', '2025-06-01', [{ code: '90000', amount: 10 }])];
    const before = JSON.stringify(m.claim);
    const error = applyAction({ type: 'applyChargeMasterPrices', match: { type: 'all' } }, m);
    expect(error).toBeUndefined();
    expect(JSON.stringify(m.claim)).toBe(before);
  });

  it('never fails or holds via executeRule, even with no charge masters loaded', () => {
    const m = makeModel();
    const rule: BillingRule = {
      id: 'r-cm',
      name: 'Price from charge master',
      description: '',
      enabled: true,
      conditional: {
        branches: [
          {
            condition: { type: 'all' },
            outcome: { type: 'actions', actions: [{ type: 'applyChargeMasterPrices', match: { type: 'all' } }] },
          },
        ],
      },
    };
    const result = executeRule(rule, m);
    expect(result.error).toBeUndefined();
    expect(result.held).toBe(false);
    expect(result.appliedActions).toHaveLength(1);
  });
});

describe('provider/facility reference swap', () => {
  it("reads the working copy's source reference; copies without one read as absent", () => {
    const m = makeModel();
    expect(readField(m, 'billingProvider.ref')).toBeUndefined();
    m.billingProvider!.extension = [
      { url: SOURCE_IDENTIFIER_SYSTEM, valueReference: { reference: 'Organization/org-src' } },
    ];
    expect(readField(m, 'billingProvider.ref')).toBe('Organization/org-src');
    expect(readField(m, 'renderingProvider.ref')).toBeUndefined();
    expect(readField(m, 'serviceFacility.ref')).toBeUndefined();
  });

  it('swaps the billing provider to a fresh working copy of the picked reference resource', () => {
    const m = makeModel();
    const original: Organization = {
      resourceType: 'Organization',
      id: 'org-new',
      name: 'New Billing Group',
      meta: { tag: [{ system: PROVIDER_ROLE_TAG, code: 'billing' }] },
    };
    m.referenceResources = new Map([['Organization/org-new', original]]);

    expect(writeField(m, 'billingProvider.ref', 'Organization/org-new')).toBe(true);

    // The model slot holds a working copy of the original under a local placeholder id...
    const copy = m.billingProvider!;
    expect(copy).not.toBe(original);
    expect(copy.name).toBe('New Billing Group');
    expect(copy.id).toBeDefined();
    expect(copy.id).not.toBe('org-new');
    expect(copy.meta?.tag).toContainEqual(BILLING_WORKING_COPY_TAG);
    expect(copy.extension).toContainEqual({
      url: SOURCE_IDENTIFIER_SYSTEM,
      valueReference: { reference: 'Organization/org-new' },
    });
    expect(m.createdCopyIds?.has(copy.id!)).toBe(true);
    // ...and the claim points at it through the temporary urn, with a display name.
    expect(m.claim.provider).toEqual({ reference: `urn:uuid:${copy.id}`, display: 'New Billing Group' });

    // Later rules see and edit the new copy — never the original reference resource.
    expect(readField(m, 'billingProvider.ref')).toBe('Organization/org-new');
    expect(writeField(m, 'billingProvider.lastName', 'Renamed Group')).toBe(true);
    expect(copy.name).toBe('Renamed Group');
    expect(original.name).toBe('New Billing Group');
  });

  it('re-points careTeam sequence 1 and every item when swapping the rendering provider', () => {
    const m = makeModel();
    m.claim.careTeam = [
      { sequence: 1, provider: { reference: 'Practitioner/old-copy' } },
      { sequence: 2, provider: { reference: 'Practitioner/referrer' } },
    ];
    m.claim.item![0].careTeamSequence = [2];
    const original: Practitioner = {
      resourceType: 'Practitioner',
      id: 'doc-2',
      name: [{ given: ['Nina'], family: 'Nguyen' }],
      meta: { tag: [{ system: PROVIDER_ROLE_TAG, code: 'rendering' }] },
    };
    m.referenceResources = new Map([['Practitioner/doc-2', original]]);

    expect(writeField(m, 'renderingProvider.ref', 'Practitioner/doc-2')).toBe(true);

    const copy = m.renderingProvider!;
    const seq1 = m.claim.careTeam!.find((member) => member.sequence === 1)!;
    expect(seq1.provider?.reference).toBe(`urn:uuid:${copy.id}`);
    expect(seq1.provider?.display).toBeDefined();
    expect(seq1.role?.coding?.[0]?.code).toBe('82');
    // The other care-team member survives, and every item points at sequence 1 plus what it had.
    expect(m.claim.careTeam).toHaveLength(2);
    expect(m.claim.item?.[0]?.careTeamSequence).toEqual([1, 2]);
  });

  it('swaps the service facility and supersedes an earlier pending copy in the same run', () => {
    const m = makeModel();
    const facilityA: Location = { resourceType: 'Location', id: 'loc-a', name: 'Clinic A' };
    const facilityB: Location = { resourceType: 'Location', id: 'loc-b', name: 'Clinic B' };
    m.referenceResources = new Map([
      ['Location/loc-a', facilityA],
      ['Location/loc-b', facilityB],
    ]);

    expect(writeField(m, 'serviceFacility.ref', 'Location/loc-a')).toBe(true);
    const firstCopyId = m.serviceFacility!.id!;
    expect(writeField(m, 'serviceFacility.ref', 'Location/loc-b')).toBe(true);

    expect(m.claim.facility?.reference).toBe(`urn:uuid:${m.serviceFacility!.id}`);
    expect(m.claim.facility?.display).toBe('Clinic B');
    // Only the surviving copy is pending creation — the superseded one must never be POSTed.
    expect(m.createdCopyIds?.has(firstCopyId)).toBe(false);
    expect(m.createdCopyIds?.size).toBe(1);
  });

  it('fails the write when the reference is missing, type-mismatched, or empty', () => {
    const m = makeModel();
    expect(writeField(m, 'billingProvider.ref', 'Organization/nope')).toBe(false); // nothing prefetched
    m.referenceResources = new Map<string, Practitioner | Organization | Location>([
      ['Location/loc-1', { resourceType: 'Location', id: 'loc-1', name: 'Clinic' }],
      ['Practitioner/doc-1', { resourceType: 'Practitioner', id: 'doc-1' }],
    ]);
    expect(writeField(m, 'billingProvider.ref', 'Location/loc-1')).toBe(false); // a facility is not a provider
    expect(writeField(m, 'serviceFacility.ref', 'Practitioner/doc-1')).toBe(false); // a provider is not a facility
    expect(writeField(m, 'renderingProvider.ref', '')).toBe(false); // no "clear the provider"
    expect(m.createdCopyIds).toBeUndefined();
    expect(m.claim.provider).toEqual({});
  });
});

describe('primary coverage from patient swap', () => {
  // The reference patient's coverages as the engine's loadPatientCoverageContext assembles them:
  // primary held through a standalone policy holder, workers comp held by the patient (Self).
  const makeCoverageContext = (): NonNullable<RulesEngineClaimModel['patientCoverageContext']> => {
    const primarySource: Coverage = {
      resourceType: 'Coverage',
      id: 'cov-src-primary',
      status: 'active',
      beneficiary: { reference: 'Patient/src-patient' },
      subscriber: { reference: 'RelatedPerson/rp-src' },
      subscriberId: 'PRIM-001',
      payor: [{ reference: getPayerUrl('111222') }],
      class: [{ type: { coding: [{ code: 'plan' }] }, value: '111222', name: 'Prime Health' }],
    };
    const wcSource: Coverage = {
      resourceType: 'Coverage',
      id: 'cov-src-wc',
      status: 'active',
      beneficiary: { reference: 'Patient/src-patient' },
      subscriber: { reference: 'Patient/src-patient' },
      subscriberId: 'WC-789',
      payor: [{ reference: getPayerUrl('999001') }],
      class: [{ type: { coding: [{ code: 'plan' }] }, value: '999001', name: 'WorkSafe' }],
    };
    const rpSource: RelatedPerson = {
      resourceType: 'RelatedPerson',
      id: 'rp-src',
      patient: { reference: 'Patient/src-patient' },
      name: [{ given: ['Sam'], family: 'Guardian' }],
      birthDate: '1975-02-02',
      gender: 'male',
    };
    return {
      byType: {
        primary: { coverage: primarySource, subscriber: rpSource },
        workersComp: { coverage: wcSource },
      },
      typeByCoverageRef: new Map<string, BillingInsuranceType>([
        ['Coverage/cov-src-primary', 'primary'],
        ['Coverage/cov-src-wc', 'workersComp'],
      ]),
    };
  };

  it('reads the slot the primary coverage was copied from; absent without a source or context', () => {
    const m = makeModel();
    m.patientCoverageContext = makeCoverageContext();
    // The claim's primary coverage carries no source stamp yet.
    expect(readField(m, 'insurance.coverageFromPatient')).toBeUndefined();
    m.coverages[0].extension = [
      { url: SOURCE_IDENTIFIER_SYSTEM, valueReference: { reference: 'Coverage/cov-src-wc' } },
    ];
    expect(readField(m, 'insurance.coverageFromPatient')).toBe('workersComp');
    // A source that no longer occupies a slot on the patient reads as absent.
    m.coverages[0].extension = [{ url: SOURCE_IDENTIFIER_SYSTEM, valueReference: { reference: 'Coverage/cov-gone' } }];
    expect(readField(m, 'insurance.coverageFromPatient')).toBeUndefined();
    // Without the prefetched context (no rule referenced the field, or no reference patient).
    m.coverages[0].extension = [
      { url: SOURCE_IDENTIFIER_SYSTEM, valueReference: { reference: 'Coverage/cov-src-wc' } },
    ];
    m.patientCoverageContext = undefined;
    expect(readField(m, 'insurance.coverageFromPatient')).toBeUndefined();
  });

  it("swaps the primary coverage to a fresh working copy of the patient's coverage (self policy holder)", () => {
    const m = makeModel();
    m.patientCoverageContext = makeCoverageContext();
    const original = m.patientCoverageContext.byType.workersComp!.coverage;

    expect(writeField(m, 'insurance.coverageFromPatient', 'workersComp')).toBe(true);

    // The model's primary slot holds a working copy of the patient's coverage under a placeholder id...
    const copy = m.coverages[0];
    expect(copy).not.toBe(original);
    expect(copy.id).toBeDefined();
    expect(copy.id).not.toBe('cov-src-wc');
    expect(copy.meta?.tag).toContainEqual(BILLING_WORKING_COPY_TAG);
    expect(copy.extension).toContainEqual({
      url: SOURCE_IDENTIFIER_SYSTEM,
      valueReference: { reference: 'Coverage/cov-src-wc' },
    });
    expect(m.createdCopyIds?.has(copy.id!)).toBe(true);
    // ...re-pointed at the claim's working-copy patient, like the claim editor's attach.
    expect(copy.beneficiary).toEqual({ reference: 'Patient/p1' });
    expect(copy.subscriber).toEqual({ reference: 'Patient/p1' });
    expect(copy.subscriberId).toBe('WC-789');
    // The original reference coverage is untouched.
    expect(original.beneficiary).toEqual({ reference: 'Patient/src-patient' });

    // The claim's focal entry points at the copy through the temporary urn with a payer display,
    // the secondary entry survives, and the insurer follows the new coverage's payor.
    expect(m.claim.insurance).toEqual([
      {
        sequence: 1,
        focal: true,
        coverage: { reference: `urn:uuid:${copy.id}`, display: 'WorkSafe (999001)' },
      },
      { sequence: 2, focal: false, coverage: { reference: 'Coverage/cov-secondary' } },
    ]);
    expect(m.claim.insurer).toEqual({ reference: getPayerUrl('999001'), display: 'WorkSafe (999001)' });

    // The swapped-out primary's policy-holder copy leaves the model with it.
    expect(m.subscribers).toEqual([]);

    // Later rules read and edit the new copy — never the original.
    expect(readField(m, 'insurance.coverageFromPatient')).toBe('workersComp');
    expect(readField(m, 'insurance.memberId')).toBe('WC-789');
    expect(writeField(m, 'insurance.memberId', 'WC-NEW')).toBe(true);
    expect(copy.subscriberId).toBe('WC-NEW');
    expect(original.subscriberId).toBe('WC-789');
  });

  it('copies the standalone policy holder and resolves it for later policy-holder rules', () => {
    const m = makeModel();
    m.patientCoverageContext = makeCoverageContext();
    const rpOriginal = m.patientCoverageContext.byType.primary!.subscriber!;

    expect(writeField(m, 'insurance.coverageFromPatient', 'primary')).toBe(true);

    // The policy holder was copied alongside the coverage and re-pointed at the claim's patient;
    // the old primary's subscriber copy (rp-1) left the model.
    expect(m.subscribers).toHaveLength(1);
    const subscriberCopy = m.subscribers[0];
    expect(subscriberCopy.id).not.toBe('rp-src');
    expect(subscriberCopy.meta?.tag).toContainEqual(BILLING_WORKING_COPY_TAG);
    expect(subscriberCopy.patient).toEqual({ reference: 'Patient/p1' });
    expect(m.coverages[0].subscriber).toEqual({ reference: `urn:uuid:${subscriberCopy.id}` });
    expect(m.createdCopyIds?.size).toBe(2);
    expect(m.createdCopyIds?.has(m.coverages[0].id!)).toBe(true);
    expect(m.createdCopyIds?.has(subscriberCopy.id!)).toBe(true);

    // policyHolder.* rules resolve the urn-referenced copy and edit it, not the original.
    expect(readField(m, 'policyHolder.firstName')).toBe('Sam');
    expect(writeField(m, 'policyHolder.firstName', 'Pat')).toBe(true);
    expect(subscriberCopy.name?.[0]?.given?.[0]).toBe('Pat');
    expect(rpOriginal.name?.[0]?.given?.[0]).toBe('Sam');
  });

  it('attaches coverage to a self-pay claim (no-coverage stub) and flips the billing type', () => {
    const m = makeModel();
    m.claim.insurance = [buildNoCoverageStub()];
    m.coverages = [];
    m.subscribers = [];
    m.patientCoverageContext = makeCoverageContext();
    expect(readField(m, 'billingType')).toBe('Self Pay');

    expect(writeField(m, 'insurance.coverageFromPatient', 'workersComp')).toBe(true);

    expect(m.claim.insurance).toHaveLength(1);
    expect(m.claim.insurance?.[0]?.coverage?.reference).toBe(`urn:uuid:${m.coverages[0].id}`);
    expect(readField(m, 'billingType')).toBe('Insurance Pay');
  });

  it('supersedes pending coverage and policy-holder copies when swapped twice in one run', () => {
    const m = makeModel();
    m.patientCoverageContext = makeCoverageContext();

    expect(writeField(m, 'insurance.coverageFromPatient', 'primary')).toBe(true);
    const firstCoverageCopyId = m.coverages[0].id!;
    const firstSubscriberCopyId = m.subscribers[0].id!;
    expect(writeField(m, 'insurance.coverageFromPatient', 'workersComp')).toBe(true);

    // Only the surviving copy is pending creation — superseded copies must never be POSTed.
    expect(m.createdCopyIds?.has(firstCoverageCopyId)).toBe(false);
    expect(m.createdCopyIds?.has(firstSubscriberCopyId)).toBe(false);
    expect(m.createdCopyIds?.size).toBe(1);
    expect(m.subscribers).toEqual([]);
    expect(m.claim.insurance?.[0]?.coverage?.reference).toBe(`urn:uuid:${m.coverages[0].id}`);
  });

  it('fails without touching the claim when the slot cannot be resolved', () => {
    const m = makeModel();
    const insuranceBefore = structuredClone(m.claim.insurance);

    // No prefetched context at all (no reference patient, or the loader found nothing).
    expect(writeField(m, 'insurance.coverageFromPatient', 'primary')).toBe(false);

    m.patientCoverageContext = makeCoverageContext();
    expect(writeField(m, 'insurance.coverageFromPatient', '')).toBe(false); // no "clear the coverage"
    expect(writeField(m, 'insurance.coverageFromPatient', 'tertiary')).toBe(false); // unknown slot
    expect(writeField(m, 'insurance.coverageFromPatient', 'secondary')).toBe(false); // slot not populated

    // A coverage held through a policy holder the context could not resolve must not be attached.
    m.patientCoverageContext.byType.primary!.subscriber = undefined;
    expect(writeField(m, 'insurance.coverageFromPatient', 'primary')).toBe(false);

    expect(m.claim.insurance).toEqual(insuranceBefore);
    expect(m.coverages[0].id).toBe('cov-primary');
    expect(m.subscribers).toHaveLength(1);
    expect(m.createdCopyIds).toBeUndefined();

    // A claim without a working-copy patient reference cannot take an attach.
    const noPatient = makeModel();
    noPatient.patientCoverageContext = makeCoverageContext();
    noPatient.claim.patient = {};
    expect(writeField(noPatient, 'insurance.coverageFromPatient', 'workersComp')).toBe(false);
  });
});

describe('rules-engine rule execution', () => {
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
    const rule: BillingRule = {
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
    const rule: BillingRule = {
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
    const holdRule: BillingRule = {
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

    const disabled: BillingRule = { ...holdRule, id: 'r-off', enabled: false };
    const m2 = makeModel();
    expect(executeRule(disabled, m2).held).toBe(false);
    expect(claimTags(m2)).toEqual([]);
  });

  it('stops with an error when a setField action cannot be applied', () => {
    const m = makeModel();
    m.renderingProvider = undefined; // the action's target is missing from the claim
    const rule: BillingRule = {
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
  const rules: BillingRule[] = [
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
    {
      id: 'rule-c',
      name: 'Rule C',
      description: 'service line actions',
      enabled: true,
      conditional: {
        branches: [
          {
            condition: { type: 'field', field: 'cptCodes', operator: 'contains', value: '99213' },
            outcome: {
              type: 'actions',
              actions: [
                {
                  type: 'updateServiceLines',
                  match: { type: 'field', property: 'cptCode', operator: 'eq', value: '99213' },
                  set: { property: 'modifiers', value: '25', operation: 'add' },
                },
                {
                  type: 'removeServiceLines',
                  match: { type: 'field', property: 'charges', operator: 'eq', value: '0' },
                },
                { type: 'addServiceLine', line: { cptCode: '99050', charges: '25' } },
              ],
            },
          },
        ],
      },
    },
  ];

  it('round-trips rules through a contained-Basic List preserving order', () => {
    const list = rulesToList('claim-submission', rules);
    expect(list.resourceType).toBe('List');
    expect(list.contained).toHaveLength(3);
    expect(list.entry?.map((e) => e.item?.reference)).toEqual(['#rule-a', '#rule-b', '#rule-c']);
    expect(listToRules(list)).toEqual(rules);
  });

  it("tags each engine's List with that engine's own code", () => {
    for (const engine of RULES_ENGINE_TYPES) {
      const list = rulesToList(engine, rules);
      expect(list.meta?.tag).toEqual([{ system: RULES_ENGINE_TAG_SYSTEM, code: RULES_ENGINE_FHIR[engine].listCode }]);
      expect(list.title).toBe(RULES_ENGINE_FHIR[engine].listTitle);
    }
    // The list codes must be distinct — each engine has its own rule set.
    const codes = RULES_ENGINE_TYPES.map((engine) => RULES_ENGINE_FHIR[engine].listCode);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('reflects reordering via entry order', () => {
    const reordered = [rules[1], rules[0]];
    const list = rulesToList('claim-submission', reordered);
    expect(listToRules(list).map((r) => r.id)).toEqual(['rule-b', 'rule-a']);
  });

  it('surfaces an unparseable rule as a disabled placeholder instead of failing the whole list', () => {
    const list = rulesToList('claim-submission', rules);
    const badRule = list.contained?.[0] as Basic;
    const definition = badRule.extension?.find((e) => e.url === RULE_DEFINITION_EXTENSION_URL);
    definition!.valueString = '{not valid json';

    const parsed = listToRules(list);
    expect(parsed).toHaveLength(3);
    // The broken rule survives (so a full-list save doesn't delete it) but is disabled and inert.
    expect(parsed[0]).toMatchObject({ id: 'rule-a', name: 'Rule A', enabled: false, conditional: { branches: [] } });
    expect(parsed[1]).toEqual(rules[1]);
    expect(parsed[2]).toEqual(rules[2]);
  });
});

describe('rules-engine kickoff task', () => {
  it("builds a requested Task focused on the claim, carrying the engine's own code", () => {
    for (const engine of RULES_ENGINE_TYPES) {
      const task = buildRulesEngineKickoffTask(engine, 'claim-123', false);
      expect(task.status).toBe('requested');
      expect(task.focus?.reference).toBe('Claim/claim-123');
      expect(task.code?.coding?.[0]).toEqual({
        system: RULES_ENGINE_TASK_SYSTEM,
        code: RULES_ENGINE_FHIR[engine].taskCode,
      });
    }
    const codes = RULES_ENGINE_TYPES.map((engine) => RULES_ENGINE_FHIR[engine].taskCode);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("builds a requested Task focused on the claim, carrying the engine's own code, skipping rules", () => {
    for (const engine of RULES_ENGINE_TYPES) {
      const task = buildRulesEngineKickoffTask(engine, 'claim-123', true);
      expect(task.status).toBe('requested');
      expect(task.focus?.reference).toBe('Claim/claim-123');
      expect(task.code?.coding?.[0]).toEqual({
        system: RULES_ENGINE_TASK_SYSTEM,
        code: RULES_ENGINE_FHIR[engine].taskCode,
      });
      expect(task.input?.[0].type.coding?.[0]).toEqual({
        system: RULES_ENGINE_INPUT_SYSTEM,
        code: RULES_ENGINE_INPUT_SKIP_RULES_CODE,
      });
    }
    const codes = RULES_ENGINE_TYPES.map((engine) => RULES_ENGINE_FHIR[engine].taskCode);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('maps task codes back to their engines', () => {
    for (const engine of RULES_ENGINE_TYPES) {
      expect(rulesEngineForTaskCode(RULES_ENGINE_FHIR[engine].taskCode)).toBe(engine);
    }
    expect(rulesEngineForTaskCode('run-unknown-rules')).toBeUndefined();
    expect(rulesEngineForTaskCode(undefined)).toBeUndefined();
  });
});
