import Oystehr from '@oystehr/sdk';
import { Encounter, FhirResource, List, Medication, MedicationAdministration, MedicationRequest } from 'fhir/r4b';
import {
  chartDataTagSystem,
  INTERACTIONS_UNAVAILABLE,
  MEDICATION_ADMINISTRATION_IN_PERSON_RESOURCE_SYSTEM,
  MEDICATION_ADMINISTRATION_ROUTES_CODES_SYSTEM,
  MEDICATION_DISPENSABLE_DRUG_ID,
  MEDICATION_IDENTIFIER_NAME_SYSTEM,
} from 'utils';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import {
  collectMedicationsForTemplate,
  isValidMedicationAdministrationForTemplate,
  medicationRequestHasInteraction,
} from '../../src/ehr/admin-create-template/index';
import { applyInHouseMedicationPlans } from '../../src/ehr/apply-template/apply-in-house-medications';
import { TemplateEncounterResource } from '../../src/ehr/shared/template-helpers';

vi.mock('../../src/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/shared')>();
  return {
    ...actual,
    getMyPractitionerId: vi.fn().mockResolvedValue('pract-1'),
  };
});

// ─── Factories ────────────────────────────────────────────────────────────────

const makeMA = (
  id: string,
  status: MedicationAdministration['status'],
  options: { withInPersonTag?: boolean } = { withInPersonTag: true }
): MedicationAdministration => ({
  resourceType: 'MedicationAdministration',
  id,
  status,
  meta: options.withInPersonTag
    ? { tag: [{ system: MEDICATION_ADMINISTRATION_IN_PERSON_RESOURCE_SYSTEM, code: 'medication-administration' }] }
    : undefined,
  medicationCodeableConcept: { coding: [] },
  subject: { reference: 'Patient/p1' },
  effectiveDateTime: '2024-01-01T00:00:00.000Z',
});

const makeTemplatePlanMA = (id: string, medicationId: string): MedicationAdministration => ({
  resourceType: 'MedicationAdministration',
  id,
  status: 'in-progress',
  meta: {
    tag: [{ system: chartDataTagSystem('in-house-medication-administration-template'), code: 'plan' }],
  },
  medicationReference: { reference: `#${medicationId}` },
  subject: { reference: 'Patient/p1' },
  effectiveDateTime: '2024-01-01T00:00:00.000Z',
  dosage: {
    route: {
      coding: [{ system: MEDICATION_ADMINISTRATION_ROUTES_CODES_SYSTEM, code: '6064005' }],
    },
    dose: { value: 5, unit: 'mg' },
  },
});

const makeMedication = (id: string, mediSpanId = 'medispan-001'): Medication => ({
  resourceType: 'Medication',
  id,
  identifier: [{ system: MEDICATION_IDENTIFIER_NAME_SYSTEM, value: 'Test Drug' }],
  code: {
    coding: [{ system: MEDICATION_DISPENSABLE_DRUG_ID, code: mediSpanId }],
  },
});

const makeTemplateList = (contained: FhirResource[]): List => ({
  resourceType: 'List',
  status: 'current',
  mode: 'working',
  contained,
  entry: [],
});

const makeEncounter = (id: string, patientId = 'patient-1'): Encounter => ({
  resourceType: 'Encounter',
  id,
  status: 'in-progress',
  class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB' },
  subject: { reference: `Patient/${patientId}` },
});

const makeOystehr = (
  checkPrecheckInteractions = vi.fn().mockResolvedValue({ allergies: [], medications: [] })
): Oystehr =>
  ({
    erx: { checkPrecheckInteractions },
  }) as unknown as Oystehr;

const makeMR = (detectedIssueRefs: (string | undefined)[]): MedicationRequest => ({
  resourceType: 'MedicationRequest',
  status: 'active',
  intent: 'order',
  subject: { reference: 'Patient/p1' },
  medicationCodeableConcept: { coding: [] },
  detectedIssue: detectedIssueRefs.map((ref) => ({ reference: ref })),
});

// A chart-data MA: has the in-person tag, a contained Medication, and a
// request reference pointing to a MedicationRequest.
const makeChartMA = (id: string, medicationId: string, mrId: string): MedicationAdministration => ({
  resourceType: 'MedicationAdministration',
  id,
  status: 'completed',
  meta: { tag: [{ system: MEDICATION_ADMINISTRATION_IN_PERSON_RESOURCE_SYSTEM, code: 'medication-administration' }] },
  medicationReference: { reference: `#${medicationId}` },
  subject: { reference: 'Patient/p1' },
  effectiveDateTime: '2024-01-01T00:00:00.000Z',
  request: { reference: `MedicationRequest/${mrId}` },
  contained: [makeMedication(medicationId)],
  dosage: {
    route: { coding: [{ system: MEDICATION_ADMINISTRATION_ROUTES_CODES_SYSTEM, code: '6064005' }] },
    dose: { value: 5, unit: 'mg' },
  },
});

// ─── isValidMedicationAdministrationForTemplate ───────────────────────────────

describe('isValidMedicationAdministrationForTemplate', () => {
  test('returns true for an MA with in-person tag and includable status', () => {
    for (const status of ['in-progress', 'on-hold', 'completed', 'not-done'] as const) {
      expect(isValidMedicationAdministrationForTemplate(makeMA('ma-1', status))).toBe(true);
    }
  });

  test('returns false for an MA with excluded status (entered-in-error)', () => {
    expect(isValidMedicationAdministrationForTemplate(makeMA('ma-1', 'entered-in-error'))).toBe(false);
  });

  test('returns false for an MA with excluded status (stopped)', () => {
    expect(isValidMedicationAdministrationForTemplate(makeMA('ma-1', 'stopped'))).toBe(false);
  });

  test('returns false for an MA with excluded status (unknown)', () => {
    expect(isValidMedicationAdministrationForTemplate(makeMA('ma-1', 'unknown'))).toBe(false);
  });

  test('returns false for an MA missing the in-person tag', () => {
    const ma = makeMA('ma-1', 'completed', { withInPersonTag: false });
    expect(isValidMedicationAdministrationForTemplate(ma)).toBe(false);
  });

  test('returns false for a non-MedicationAdministration resource', () => {
    const condition: TemplateEncounterResource = {
      resourceType: 'Condition',
      id: 'c-1',
      subject: { reference: 'Patient/p1' },
    } as unknown as TemplateEncounterResource;
    expect(isValidMedicationAdministrationForTemplate(condition)).toBe(false);
  });
});

// ─── medicationRequestHasInteraction ─────────────────────────────────────────

describe('medicationRequestHasInteraction', () => {
  test('returns false when detectedIssue is undefined', () => {
    const mr: MedicationRequest = {
      resourceType: 'MedicationRequest',
      status: 'active',
      intent: 'order',
      subject: { reference: 'Patient/p1' },
      medicationCodeableConcept: { coding: [] },
    };
    expect(medicationRequestHasInteraction(mr)).toBe(false);
  });

  test('returns false when detectedIssue is an empty array', () => {
    const mr = makeMR([]);
    expect(medicationRequestHasInteraction(mr)).toBe(false);
  });

  test('returns false when the single detectedIssue is the interactions-unavailable sentinel', () => {
    const mr = makeMR([`DetectedIssue/${INTERACTIONS_UNAVAILABLE}-0`]);
    expect(medicationRequestHasInteraction(mr)).toBe(false);
  });

  test('returns true when there is a single real interaction (not the unavailable sentinel)', () => {
    const mr = makeMR(['DetectedIssue/drug-interaction-0']);
    expect(medicationRequestHasInteraction(mr)).toBe(true);
  });

  test('returns true when there are multiple detectedIssues', () => {
    const mr = makeMR([`DetectedIssue/${INTERACTIONS_UNAVAILABLE}-0`, 'DetectedIssue/drug-interaction-1']);
    expect(medicationRequestHasInteraction(mr)).toBe(true);
  });
});

// ─── applyInHouseMedicationPlans ─────────────────────────────────────────────

describe('applyInHouseMedicationPlans', () => {
  const encounter = makeEncounter('enc-1', 'patient-1');
  const baseInput = {
    encounter,
    userToken: 'test-token',
    secrets: null,
    conditionRequests: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('returns empty result immediately when action is "skip"', async () => {
    const result = await applyInHouseMedicationPlans({
      ...baseInput,
      templateList: makeTemplateList([]),
      oystehr: makeOystehr(),
      action: 'skip',
    });
    expect(result.warnings).toHaveLength(0);
    expect(result.requests).toHaveLength(0);
  });

  test('returns empty result when template has no medication plan MAs', async () => {
    const result = await applyInHouseMedicationPlans({
      ...baseInput,
      templateList: makeTemplateList([]),
      oystehr: makeOystehr(),
      action: 'append',
    });
    expect(result.warnings).toHaveLength(0);
    expect(result.requests).toHaveLength(0);
  });

  test('produces a warning and skips a medication whose Medication resource is missing', async () => {
    const ma = makeTemplatePlanMA('ma-1', 'missing-med-id');
    const result = await applyInHouseMedicationPlans({
      ...baseInput,
      templateList: makeTemplateList([ma]),
      oystehr: makeOystehr(),
      action: 'append',
    });
    expect(result.requests).toHaveLength(0);
    expect(result.warnings[0].message).toMatch(/medication information not found/i);
  });

  test('produces a warning and skips a medication with no dose value', async () => {
    const med = makeMedication('med-1');
    const ma: MedicationAdministration = {
      ...makeTemplatePlanMA('ma-1', 'med-1'),
      dosage: {
        route: {
          coding: [{ system: MEDICATION_ADMINISTRATION_ROUTES_CODES_SYSTEM, code: '6064005' }],
        },
        // dose intentionally omitted
      },
    };
    const result = await applyInHouseMedicationPlans({
      ...baseInput,
      templateList: makeTemplateList([ma, med]),
      oystehr: makeOystehr(),
      action: 'append',
    });
    expect(result.requests).toHaveLength(0);
    expect(result.warnings[0].message).toMatch(/dose not found/i);
  });

  test('produces a warning and skips a medication with an unrecognized route code', async () => {
    const med = makeMedication('med-1');
    const ma: MedicationAdministration = {
      ...makeTemplatePlanMA('ma-1', 'med-1'),
      dosage: {
        route: {
          coding: [{ system: MEDICATION_ADMINISTRATION_ROUTES_CODES_SYSTEM, code: 'UNKNOWN-ROUTE' }],
        },
        dose: { value: 5, unit: 'mg' },
      },
    };
    const result = await applyInHouseMedicationPlans({
      ...baseInput,
      templateList: makeTemplateList([ma, med]),
      oystehr: makeOystehr(),
      action: 'append',
    });
    expect(result.requests).toHaveLength(0);
    expect(result.warnings[0].message).toMatch(/route of administration not found/i);
  });

  test('returns interaction warning and no requests when medication lacks a MediSpan ID', async () => {
    const med = makeMedication('med-1', '');
    // Strip coding so getMediSpanIdForInteraction returns undefined
    med.code = { coding: [] };
    const ma = makeTemplatePlanMA('ma-1', 'med-1');
    const result = await applyInHouseMedicationPlans({
      ...baseInput,
      templateList: makeTemplateList([ma, med]),
      oystehr: makeOystehr(),
      action: 'append',
    });
    expect(result.requests).toHaveLength(0);
    expect(result.warnings[0].message).toMatch(/missing drug id/i);
  });

  test('returns interaction warning and no requests when ERX check detects a drug interaction', async () => {
    const med = makeMedication('med-1');
    const ma = makeTemplatePlanMA('ma-1', 'med-1');
    const checkPrecheckInteractions = vi
      .fn()
      .mockResolvedValue({ allergies: [], medications: [{ message: 'Interaction found' }] });
    const result = await applyInHouseMedicationPlans({
      ...baseInput,
      templateList: makeTemplateList([ma, med]),
      oystehr: makeOystehr(checkPrecheckInteractions),
      action: 'append',
    });
    expect(result.requests).toHaveLength(0);
    expect(result.warnings[0].message).toMatch(/interaction detected/i);
  });

  test('returns interaction warning and no requests when ERX check detects an allergy interaction', async () => {
    const med = makeMedication('med-1');
    const ma = makeTemplatePlanMA('ma-1', 'med-1');
    const checkPrecheckInteractions = vi
      .fn()
      .mockResolvedValue({ allergies: [{ message: 'Allergy conflict' }], medications: [] });
    const result = await applyInHouseMedicationPlans({
      ...baseInput,
      templateList: makeTemplateList([ma, med]),
      oystehr: makeOystehr(checkPrecheckInteractions),
      action: 'append',
    });
    expect(result.requests).toHaveLength(0);
    expect(result.warnings[0].message).toMatch(/interaction detected/i);
  });

  test('returns interaction warning and no requests when ERX check throws', async () => {
    const med = makeMedication('med-1');
    const ma = makeTemplatePlanMA('ma-1', 'med-1');
    const checkPrecheckInteractions = vi.fn().mockRejectedValue(new Error('ERX service unavailable'));
    const result = await applyInHouseMedicationPlans({
      ...baseInput,
      templateList: makeTemplateList([ma, med]),
      oystehr: makeOystehr(checkPrecheckInteractions),
      action: 'append',
    });
    expect(result.requests).toHaveLength(0);
    expect(result.warnings[0].message).toMatch(/unable to determine medication interaction/i);
  });

  test('if any medication has an interaction, no requests are created for any med', async () => {
    const med1 = makeMedication('med-1');
    const ma1 = makeTemplatePlanMA('ma-1', 'med-1');
    const med2 = makeMedication('med-2');
    const ma2 = makeTemplatePlanMA('ma-2', 'med-2');

    let callCount = 0;
    const checkPrecheckInteractions = vi.fn().mockImplementation(() => {
      callCount++;
      // first med: no interaction. second med: interaction found.
      return callCount === 1
        ? Promise.resolve({ allergies: [], medications: [] })
        : Promise.resolve({ allergies: [], medications: [{ message: 'found' }] });
    });

    const result = await applyInHouseMedicationPlans({
      ...baseInput,
      templateList: makeTemplateList([ma1, med1, ma2, med2]),
      oystehr: makeOystehr(checkPrecheckInteractions),
      action: 'append',
    });

    expect(result.requests).toHaveLength(0);
    expect(result.warnings[0].message).toMatch(/interaction detected/i);
  });

  test('returns one MA request and one MR request per medication when all checks pass', async () => {
    const med = makeMedication('med-1');
    const ma = makeTemplatePlanMA('ma-1', 'med-1');
    const result = await applyInHouseMedicationPlans({
      ...baseInput,
      templateList: makeTemplateList([ma, med]),
      oystehr: makeOystehr(),
      action: 'append',
    });
    expect(result.warnings).toHaveLength(0);
    expect(result.requests).toHaveLength(2);
    expect(result.requests[0]).toMatchObject({ method: 'POST', url: '/MedicationAdministration' });
    expect(result.requests[1]).toMatchObject({ method: 'POST', url: '/MedicationRequest' });
  });

  test('creates requests for each medication when the template has multiple meds', async () => {
    const med1 = makeMedication('med-1');
    const ma1 = makeTemplatePlanMA('ma-1', 'med-1');
    const med2 = makeMedication('med-2');
    const ma2 = makeTemplatePlanMA('ma-2', 'med-2');
    const result = await applyInHouseMedicationPlans({
      ...baseInput,
      templateList: makeTemplateList([ma1, med1, ma2, med2]),
      oystehr: makeOystehr(),
      action: 'append',
    });
    expect(result.warnings).toHaveLength(0);
    expect(result.requests).toHaveLength(4);
    const urls = result.requests.map((r) => r.url);
    expect(urls.filter((u) => u === '/MedicationAdministration')).toHaveLength(2);
    expect(urls.filter((u) => u === '/MedicationRequest')).toHaveLength(2);
  });
});

// ─── collectMedicationsForTemplate ───────────────────────────────────────────

describe('collectMedicationsForTemplate', () => {
  const baseParams = {
    diagnosisConditionById: new Map(),
    stubPatientId: 'stub-patient-1',
    oldIdToNewIdMap: new Map<string, string>(),
  };

  test('first medication has no interaction, second does — no medications are added to the template', () => {
    const ma1 = makeChartMA('ma-1', 'med-1', 'mr-1');
    const ma2 = makeChartMA('ma-2', 'med-2', 'mr-2');

    const mrNoInteraction = makeMR([]);
    const mrWithInteraction = makeMR(['DetectedIssue/drug-interaction-0']);

    const medicationRequestByIdMap = new Map<string, MedicationRequest>([
      ['mr-1', mrNoInteraction],
      ['mr-2', mrWithInteraction],
    ]);

    const result = collectMedicationsForTemplate({
      ...baseParams,
      medicationAdministrations: [ma1, ma2],
      medicationRequestByIdMap,
    });

    expect(result.medicationInteractionDetected).toBe(true);
    expect(result.medsForContained).toHaveLength(0);
    expect(result.medAdminsForContained).toHaveLength(0);
    expect(result.medicationEntries).toHaveLength(0);
  });

  test('all medications have no interaction — both are buffered for the template', () => {
    const ma1 = makeChartMA('ma-1', 'med-1', 'mr-1');
    const ma2 = makeChartMA('ma-2', 'med-2', 'mr-2');

    const medicationRequestByIdMap = new Map<string, MedicationRequest>([
      ['mr-1', makeMR([])],
      ['mr-2', makeMR([])],
    ]);

    const result = collectMedicationsForTemplate({
      ...baseParams,
      medicationAdministrations: [ma1, ma2],
      medicationRequestByIdMap,
    });

    expect(result.medicationInteractionDetected).toBe(false);
    expect(result.medsForContained).toHaveLength(2);
    expect(result.medAdminsForContained).toHaveLength(2);
    expect(result.medicationEntries).toHaveLength(2);
  });
});
