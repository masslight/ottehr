import Oystehr from '@oystehr/sdk';
import {
  Condition,
  Encounter,
  FhirResource,
  List,
  Medication,
  MedicationAdministration,
  MedicationRequest,
} from 'fhir/r4b';
import {
  chartDataTagSystem,
  CODE_SYSTEM_ICD_10,
  INTERACTIONS_UNAVAILABLE,
  MEDICATION_ADMINISTRATION_IN_PERSON_RESOURCE_SYSTEM,
  MEDICATION_ADMINISTRATION_ROUTES_CODES_SYSTEM,
  MEDICATION_DISPENSABLE_DRUG_ID,
  MEDICATION_IDENTIFIER_NAME_SYSTEM,
  ResolvedSectionActions,
} from 'utils';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import {
  collectMedicationsForTemplate,
  isValidMedicationAdministrationForTemplate,
  medicationRequestHasInteraction,
} from '../../src/ehr/admin-create-template/index';
import {
  applyInHouseMedicationPlans,
  getAssociatedDxFromMaAndRequests,
} from '../../src/ehr/apply-template/apply-in-house-medications';
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
  const appendActions: ResolvedSectionActions = {
    hpi: 'append',
    moi: 'append',
    ros: 'append',
    examFindings: 'append',
    mdm: 'append',
    diagnoses: 'append',
    patientInstructions: 'append',
    cptCodes: 'append',
    emCode: 'append',
    inHouseLabs: 'append',
    externalLabs: 'append',
    procedures: 'append',
    inHouseMedications: 'append',
  };
  const skipActions: ResolvedSectionActions = { ...appendActions, inHouseMedications: 'skip' };

  const baseInput = {
    encounter,
    userToken: 'test-token',
    secrets: null,
    conditionRequests: [],
    encounterResources: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('returns empty result immediately when action is "skip"', async () => {
    const result = await applyInHouseMedicationPlans({
      ...baseInput,
      templateList: makeTemplateList([]),
      oystehr: makeOystehr(),
      actions: skipActions,
    });
    expect(result.warnings).toHaveLength(0);
    expect(result.requests).toHaveLength(0);
  });

  test('returns empty result when template has no medication plan MAs', async () => {
    const result = await applyInHouseMedicationPlans({
      ...baseInput,
      templateList: makeTemplateList([]),
      oystehr: makeOystehr(),
      actions: appendActions,
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
      actions: appendActions,
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
      actions: appendActions,
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
      actions: appendActions,
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
      actions: appendActions,
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
      actions: appendActions,
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
      actions: appendActions,
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
      actions: appendActions,
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
      actions: appendActions,
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
      actions: appendActions,
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
      actions: appendActions,
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
    expect(result.templateResources).toHaveLength(0);
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
    expect(result.templateResources).toHaveLength(4);
  });
});

// ─── getAssociatedDxFromMaAndRequests ─────────────────────────────────────────

const makeCondition = (id: string, icdCode: string): Condition => ({
  resourceType: 'Condition',
  id,
  subject: { reference: 'Patient/p1' },
  // isDiagnosisCondition requires this tag to treat the Condition as a diagnosis
  meta: { tag: [{ system: chartDataTagSystem('diagnosis'), code: 'diagnosis' }] },
  code: {
    coding: [{ system: CODE_SYSTEM_ICD_10, code: icdCode, display: `Condition ${icdCode}` }],
  },
});

const makeMaWithReasonCode = (icdCode: string): MedicationAdministration => ({
  resourceType: 'MedicationAdministration',
  id: 'template-ma-1',
  status: 'in-progress',
  medicationCodeableConcept: { coding: [] },
  subject: { reference: 'Patient/p1' },
  effectiveDateTime: '2024-01-01T00:00:00.000Z',
  reasonCode: [
    {
      coding: [{ system: CODE_SYSTEM_ICD_10, code: icdCode, display: `Condition ${icdCode}` }],
    },
  ],
});

describe('getAssociatedDxFromMaAndRequests', () => {
  test('returns undefined when the MA has no reasonCode', () => {
    const ma: MedicationAdministration = {
      resourceType: 'MedicationAdministration',
      id: 'ma-1',
      status: 'in-progress',
      medicationCodeableConcept: { coding: [] },
      subject: { reference: 'Patient/p1' },
      effectiveDateTime: '2024-01-01T00:00:00.000Z',
    };
    const result = getAssociatedDxFromMaAndRequests(ma, new Map(), 'append', []);
    expect(result).toBeUndefined();
  });

  test('returns undefined when the MA has an empty reasonCode array', () => {
    const ma: MedicationAdministration = {
      ...makeMaWithReasonCode('Z00.00'),
      reasonCode: [],
    };
    const result = getAssociatedDxFromMaAndRequests(ma, new Map(), 'append', []);
    expect(result).toBeUndefined();
  });

  test('returns Condition/id when the ICD-10 code matches an existing encounter Condition (append action)', () => {
    const icdCode = 'J06.9';
    const ma = makeMaWithReasonCode(icdCode);
    const existingCondition = makeCondition('cond-existing', icdCode);
    const result = getAssociatedDxFromMaAndRequests(ma, new Map(), 'append', [existingCondition]);
    expect(result).toBe('Condition/cond-existing');
  });

  test('returns Condition/id when the ICD-10 code matches an existing encounter Condition (skip action)', () => {
    const icdCode = 'Z00.00';
    const ma = makeMaWithReasonCode(icdCode);
    const existingCondition = makeCondition('cond-skip', icdCode);
    const result = getAssociatedDxFromMaAndRequests(ma, new Map(), 'skip', [existingCondition]);
    expect(result).toBe('Condition/cond-skip');
  });

  test('falls back to dxFullUrlByCodeMap when ICD-10 code not on encounter (append action)', () => {
    const icdCode = 'J06.9';
    const ma = makeMaWithReasonCode(icdCode);
    const dxMap = new Map([[icdCode, 'urn:uuid:newly-created-condition']]);
    const result = getAssociatedDxFromMaAndRequests(ma, dxMap, 'append', []);
    expect(result).toBe('urn:uuid:newly-created-condition');
  });

  test('returns undefined when ICD-10 code is neither on encounter nor in dxFullUrlByCodeMap', () => {
    const icdCode = 'J06.9';
    const ma = makeMaWithReasonCode(icdCode);
    const result = getAssociatedDxFromMaAndRequests(ma, new Map(), 'append', []);
    expect(result).toBeUndefined();
  });

  test('skips encounter lookup entirely for overwrite action and goes straight to dxFullUrlByCodeMap', () => {
    const icdCode = 'J06.9';
    const ma = makeMaWithReasonCode(icdCode);
    // A matching Condition exists on the encounter — overwrite should ignore it
    const existingCondition = makeCondition('cond-existing', icdCode);
    const dxMap = new Map([[icdCode, 'urn:uuid:overwritten-condition']]);
    const result = getAssociatedDxFromMaAndRequests(ma, dxMap, 'overwrite', [existingCondition]);
    expect(result).toBe('urn:uuid:overwritten-condition');
  });

  test('overwrite action returns undefined when code is not in dxFullUrlByCodeMap even if on encounter', () => {
    const icdCode = 'J06.9';
    const ma = makeMaWithReasonCode(icdCode);
    const existingCondition = makeCondition('cond-existing', icdCode);
    const result = getAssociatedDxFromMaAndRequests(ma, new Map(), 'overwrite', [existingCondition]);
    expect(result).toBeUndefined();
  });

  test('bug: empty-string false match — condition with no ICD-10 code should not match MA with no ICD-10 code', () => {
    // makeDiagnosisDTO reads coding[0].code without a system filter.
    // A Condition whose first coding has a non-ICD-10 system produces code=''.
    // A templateMA whose reasonCode yields code='' also produces dxDto.code=''.
    // The map would then map '' -> some Condition, and the lookup '' would hit it — a false positive.
    const conditionWithNoIcdCode: Condition = {
      resourceType: 'Condition',
      id: 'cond-no-icd',
      subject: { reference: 'Patient/p1' },
      code: {
        coding: [{ system: 'http://some-other-system.com', code: '', display: 'Unknown' }],
      },
    };
    const maWithNoIcdCode: MedicationAdministration = {
      resourceType: 'MedicationAdministration',
      id: 'ma-no-icd',
      status: 'in-progress',
      medicationCodeableConcept: { coding: [] },
      subject: { reference: 'Patient/p1' },
      effectiveDateTime: '2024-01-01T00:00:00.000Z',
      reasonCode: [
        // coding has no recognized ICD-10 system, so diagnosesFromReasonCode will fall back to coding[0]
        // which has an empty code — the filter(d => d.code || d.display) keeps it only if there's a display
        {
          coding: [{ system: 'http://some-other-system.com', code: '', display: '' }],
        },
      ],
    };
    // diagnosesFromReasonCode filters out entries where both code and display are empty,
    // so dxDto will be undefined and the function returns undefined early — no false match.
    const result = getAssociatedDxFromMaAndRequests(maWithNoIcdCode, new Map(), 'append', [conditionWithNoIcdCode]);
    expect(result).toBeUndefined();
  });

  test('non-diagnosis Conditions in encounterResources are ignored', () => {
    const icdCode = 'Z00.00';
    const ma = makeMaWithReasonCode(icdCode);
    // This Condition lacks the diagnosis extension/tag that isDiagnosisCondition checks for
    const nonDxCondition: Condition = {
      resourceType: 'Condition',
      id: 'cond-non-dx',
      subject: { reference: 'Patient/p1' },
      code: {
        coding: [{ system: CODE_SYSTEM_ICD_10, code: icdCode }],
      },
    };
    // Without the diagnosis tag, isDiagnosisCondition returns false and the condition is skipped
    const dxMap = new Map([[icdCode, 'urn:uuid:fallback']]);
    const result = getAssociatedDxFromMaAndRequests(ma, dxMap, 'append', [nonDxCondition]);
    // Falls through to dxMap since the non-dx condition was filtered out
    expect(result).toBe('urn:uuid:fallback');
  });
});
