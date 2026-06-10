import { Condition, Encounter, Observation, Procedure, ServiceRequest } from 'fhir/r4b';
import {
  chartDataTagSystem,
  ICD_10_CODE_SYSTEM,
  IN_HOUSE_TEST_CODE_SYSTEM,
  REPEAT_TEST_ORDER_DETAIL_TAG_CONFIG,
} from 'utils';
import { describe, expect, test } from 'vitest';
import {
  filterEntriesToTemplateContent,
  isValidInHouseLabServiceRequest,
  isValidProcedureServiceRequest,
} from '../../src/ehr/admin-create-template/index';
import { isInHouseLabRepeatTestCptCode, TemplateEncounterResource } from '../../src/ehr/shared/template-helpers';

const makeDxCondition = (id: string, encounterId = 'enc-1'): Condition => ({
  resourceType: 'Condition',
  id,
  subject: { reference: 'Patient/p1' },
  encounter: { reference: `Encounter/${encounterId}` },
  meta: { tag: [{ system: chartDataTagSystem('diagnosis'), code: 'diagnosis' }] },
  code: { coding: [{ system: ICD_10_CODE_SYSTEM, code: 'J02.9' }] },
});

const makeMedicalCondition = (id: string, encounterId = 'enc-1'): Condition => ({
  resourceType: 'Condition',
  id,
  subject: { reference: 'Patient/p1' },
  encounter: { reference: `Encounter/${encounterId}` },
  meta: { tag: [{ system: chartDataTagSystem('medical-condition'), code: 'medical-condition' }] },
  code: { coding: [{ system: ICD_10_CODE_SYSTEM, code: 'J45.909' }] },
});

const makeObservation = (id: string, tagField: string): Observation => ({
  resourceType: 'Observation',
  id,
  status: 'final',
  code: { coding: [] },
  meta: { tag: [{ system: chartDataTagSystem(tagField), code: tagField }] },
});

const makeEncounter = (id: string, diagnosisConditionIds: string[]): Encounter => ({
  resourceType: 'Encounter',
  id,
  status: 'in-progress',
  class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB' },
  diagnosis: diagnosisConditionIds.map((condId) => ({
    condition: { reference: `Condition/${condId}` },
  })),
});

describe('filterEntriesToTemplateContent', () => {
  test('always passes the Encounter resource through', () => {
    const enc = makeEncounter('enc-1', []);
    const result = filterEntriesToTemplateContent([enc], new Set());
    expect(result).toHaveLength(1);
    expect(result[0].resourceType).toBe('Encounter');
  });

  test('includes a Diagnosis Condition that is currently on Encounter.diagnosis', () => {
    const dx = makeDxCondition('dx-1');
    const diagnosesSet = new Set(['Condition/dx-1']);
    const result = filterEntriesToTemplateContent([dx], diagnosesSet);
    expect(result).toHaveLength(1);
  });

  test('excludes a Diagnosis Condition that is NOT on Encounter.diagnosis (stale _revinclude:iterate result)', () => {
    // This models the case where a Condition references the Encounter (so the FHIR search picks it up)
    // but it was removed from Encounter.diagnosis at some point and should not end up in the template.
    const dx = makeDxCondition('dx-stale');
    const diagnosesSet = new Set<string>(); // enc.diagnosis is empty — dx-stale was removed
    const result = filterEntriesToTemplateContent([dx], diagnosesSet);
    expect(result).toHaveLength(0);
  });

  test('excludes a stale Diagnosis Condition even when the encounter has other active diagnoses', () => {
    // The encounter has one active Dx (dx-active) and the FHIR search also returned a Condition
    // that was previously removed from Encounter.diagnosis (dx-stale). Only dx-active should pass.
    const staleDx = makeDxCondition('dx-stale');
    const diagnosesSet = new Set(['Condition/dx-active']); // dx-stale is absent from the set
    const result = filterEntriesToTemplateContent([staleDx], diagnosesSet);
    expect(result).toHaveLength(0);
  });

  test('excludes a Medical Condition even when it carries an ICD-10 code', () => {
    // Medical Conditions can carry ICD-10 codes (the UI lets users pick one), but they are
    // patient history, not visit diagnoses, and must never be included in a template.
    const medCond = makeMedicalCondition('mc-1');
    const diagnosesSet = new Set(['Condition/mc-1']); // even if it were mistakenly in the set
    const result = filterEntriesToTemplateContent([medCond], diagnosesSet);
    expect(result).toHaveLength(0);
  });

  test('includes an Observation tagged with a template-relevant field', () => {
    const obs = makeObservation('obs-1', 'exam-observation-field');
    const result = filterEntriesToTemplateContent([obs], new Set());
    expect(result).toHaveLength(1);
  });

  test('excludes an Observation with no template-relevant tag', () => {
    const obs: Observation = {
      resourceType: 'Observation',
      id: 'obs-unrelated',
      status: 'final',
      code: { coding: [] },
      meta: { tag: [{ system: 'https://some-other-system.com', code: 'vitals' }] },
    };
    const result = filterEntriesToTemplateContent([obs], new Set());
    expect(result).toHaveLength(0);
  });

  test('a bundle with mixed resources keeps only the right ones', () => {
    const enc = makeEncounter('enc-1', ['dx-active']);
    const activeDx = makeDxCondition('dx-active');
    const staleDx = makeDxCondition('dx-stale');
    const medCond = makeMedicalCondition('mc-1');
    const examObs = makeObservation('obs-1', 'exam-observation-field');
    const rosObs = makeObservation('obs-2', 'ros-observation-field');

    const diagnosesSet = new Set(['Condition/dx-active']);
    const resources: TemplateEncounterResource[] = [enc, activeDx, staleDx, medCond, examObs, rosObs];
    const result = filterEntriesToTemplateContent(resources, diagnosesSet);

    const ids = result.map((r) => r.id);
    expect(ids).toContain('enc-1');
    expect(ids).toContain('dx-active');
    expect(ids).toContain('obs-1');
    expect(ids).toContain('obs-2');
    expect(ids).not.toContain('dx-stale');
    expect(ids).not.toContain('mc-1');
  });
});

// ---------------------------------------------------------------------------
// isValidInHouseLabServiceRequest — in-house lab SR capture filter
// ---------------------------------------------------------------------------

const AD_CANONICAL_URL_BASE = 'https://ottehr.com/FHIR/InHouseLab/ActivityDefinition';

const makeStandardInHouseLabSR = (id: string, overrides: Partial<ServiceRequest> = {}): ServiceRequest => ({
  resourceType: 'ServiceRequest',
  id,
  status: 'active',
  intent: 'order',
  subject: { reference: 'Patient/p1' },
  code: { coding: [{ system: IN_HOUSE_TEST_CODE_SYSTEM, code: 'STREP-RAPID' }] },
  instantiatesCanonical: [`${AD_CANONICAL_URL_BASE}/strep-rapid`],
  ...overrides,
});

describe('isValidInHouseLabServiceRequest', () => {
  test('includes a standard active in-house lab order', () => {
    const sr = makeStandardInHouseLabSR('sr-1');
    expect(isValidInHouseLabServiceRequest(sr)).toBe(true);
  });

  test('includes orders with includable statuses: draft, on-hold, completed', () => {
    for (const status of ['draft', 'on-hold', 'completed'] as ServiceRequest['status'][]) {
      expect(isValidInHouseLabServiceRequest(makeStandardInHouseLabSR(`sr-${status}`, { status }))).toBe(true);
    }
  });

  test('excludes a revoked (canceled) order — should not carry deleted orders into templates', () => {
    const sr = makeStandardInHouseLabSR('sr-revoked', { status: 'revoked' });
    expect(isValidInHouseLabServiceRequest(sr)).toBe(false);
  });

  test('excludes an entered-in-error order', () => {
    const sr = makeStandardInHouseLabSR('sr-error', { status: 'entered-in-error' });
    expect(isValidInHouseLabServiceRequest(sr)).toBe(false);
  });

  test('excludes a repeat test SR (tagged with REPEAT_TEST_ORDER_DETAIL_TAG_CONFIG)', () => {
    const sr = makeStandardInHouseLabSR('sr-repeat', {
      meta: {
        tag: [{ system: REPEAT_TEST_ORDER_DETAIL_TAG_CONFIG.system, code: REPEAT_TEST_ORDER_DETAIL_TAG_CONFIG.code }],
      },
    });
    expect(isValidInHouseLabServiceRequest(sr)).toBe(false);
  });

  test('excludes a reflex test SR (basedOn references another ServiceRequest)', () => {
    const sr = makeStandardInHouseLabSR('sr-reflex', {
      basedOn: [{ reference: 'ServiceRequest/sr-parent' }],
    });
    expect(isValidInHouseLabServiceRequest(sr)).toBe(false);
  });

  test('does not exclude an SR whose basedOn references a non-ServiceRequest resource', () => {
    // basedOn can reference other resource types (e.g., PlanDefinition); only SR references
    // indicate a reflex relationship and should be excluded.
    const sr = makeStandardInHouseLabSR('sr-based-on-plan', {
      basedOn: [{ reference: 'PlanDefinition/some-plan' }],
    });
    expect(isValidInHouseLabServiceRequest(sr)).toBe(true);
  });

  test('excludes an SR that does not instantiate an ActivityDefinition from the known canonical base', () => {
    const sr = makeStandardInHouseLabSR('sr-no-canonical', { instantiatesCanonical: undefined });
    expect(isValidInHouseLabServiceRequest(sr)).toBe(false);
  });

  test('excludes an SR without the in-house test code system', () => {
    const sr = makeStandardInHouseLabSR('sr-no-code', {
      code: { coding: [{ system: 'http://some-other-system.com', code: 'TEST' }] },
    });
    expect(isValidInHouseLabServiceRequest(sr)).toBe(false);
  });

  test('non-ServiceRequest resource returns false', () => {
    const obs: TemplateEncounterResource = {
      resourceType: 'Observation',
      id: 'obs-1',
      status: 'final',
      code: {},
    };
    expect(isValidInHouseLabServiceRequest(obs)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isInHouseLabRepeatTestCptCode — repeat test CPT Procedure filter
// ---------------------------------------------------------------------------

const CPT_CODE_SYSTEM = 'http://www.ama-assn.org/go/cpt';
const CPT_MODIFIER_EXTENSION_URL = 'https://fhir.ottehr.com/Extension/cpt-code-modifier';
const CPT_MODIFIER_CODE_SYSTEM = 'https://fhir.ottehr.com/CodeSystem/cpt-code-modifier';
const REPEAT_CPT_MODIFIER_CODE = '91';

const makeRepeatCptProcedure = (id: string): Procedure => ({
  resourceType: 'Procedure',
  id,
  status: 'completed',
  subject: { reference: 'Patient/p1' },
  meta: { tag: [{ system: chartDataTagSystem('cpt-code'), code: 'cpt-code' }] },
  code: {
    coding: [
      {
        system: CPT_CODE_SYSTEM,
        code: '87880',
        extension: [
          {
            url: CPT_MODIFIER_EXTENSION_URL,
            valueCodeableConcept: {
              coding: [{ system: CPT_MODIFIER_CODE_SYSTEM, code: REPEAT_CPT_MODIFIER_CODE }],
            },
          },
        ],
      },
    ],
  },
});

const makeStandardCptProcedure = (id: string, cptCode = '99213'): Procedure => ({
  resourceType: 'Procedure',
  id,
  status: 'completed',
  subject: { reference: 'Patient/p1' },
  meta: { tag: [{ system: chartDataTagSystem('cpt-code'), code: 'cpt-code' }] },
  code: { coding: [{ system: CPT_CODE_SYSTEM, code: cptCode }] },
});

describe('isInHouseLabRepeatTestCptCode', () => {
  test('identifies a Procedure with modifier 91 as a repeat test CPT code', () => {
    expect(isInHouseLabRepeatTestCptCode(makeRepeatCptProcedure('proc-1'))).toBe(true);
  });

  test('does not identify a standard CPT Procedure (no modifier) as a repeat test CPT code', () => {
    expect(isInHouseLabRepeatTestCptCode(makeStandardCptProcedure('proc-1'))).toBe(false);
  });

  test('does not identify a non-Procedure resource as a repeat test CPT code', () => {
    const obs: TemplateEncounterResource = {
      resourceType: 'Observation',
      id: 'obs-1',
      status: 'final',
      code: {},
    };
    expect(isInHouseLabRepeatTestCptCode(obs)).toBe(false);
  });

  test('does not identify a Procedure without the cpt-code tag as a repeat test CPT code', () => {
    const proc: Procedure = {
      ...makeRepeatCptProcedure('proc-no-tag'),
      meta: { tag: [{ system: 'some-other-system', code: 'other' }] },
    };
    expect(isInHouseLabRepeatTestCptCode(proc)).toBe(false);
  });
});

describe('filterEntriesToTemplateContent — in-house lab repeat CPT filtering', () => {
  test('excludes a CPT Procedure with modifier 91 (repeat test charge)', () => {
    const repeatProc = makeRepeatCptProcedure('proc-repeat');
    const result = filterEntriesToTemplateContent([repeatProc], new Set());
    expect(result).toHaveLength(0);
  });

  test('includes a standard CPT Procedure without a repeat modifier', () => {
    const standardProc = makeStandardCptProcedure('proc-standard');
    const result = filterEntriesToTemplateContent([standardProc], new Set());
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('proc-standard');
  });

  test('mixed bundle: repeat CPT Procedure is excluded while standard CPT Procedure is kept', () => {
    const repeatProc = makeRepeatCptProcedure('proc-repeat');
    const standardProc = makeStandardCptProcedure('proc-standard');
    const result = filterEntriesToTemplateContent([repeatProc, standardProc], new Set());
    const ids = result.map((r) => r.id);
    expect(ids).not.toContain('proc-repeat');
    expect(ids).toContain('proc-standard');
  });
});

// ---------------------------------------------------------------------------
// isValidProcedureServiceRequest — in-office procedure SR capture filter
// ---------------------------------------------------------------------------

const makeStandardProcedureSR = (id: string, overrides: Partial<ServiceRequest> = {}): ServiceRequest => ({
  resourceType: 'ServiceRequest',
  id,
  status: 'completed',
  intent: 'original-order',
  subject: { reference: 'Patient/p1' },
  meta: { tag: [{ system: chartDataTagSystem('procedure'), code: 'procedure' }] },
  ...overrides,
});

describe('isValidProcedureServiceRequest', () => {
  test('includes a standard completed procedure', () => {
    expect(isValidProcedureServiceRequest(makeStandardProcedureSR('sr-1'))).toBe(true);
  });

  test('includes orders with includable statuses: draft, active, on-hold, completed', () => {
    // Procedures generally save with status='completed' (post-facto records),
    // but the same inclusion list is used as for in-house labs in case a
    // procedure workflow ever lands in an intermediate state.
    for (const status of ['draft', 'active', 'on-hold', 'completed'] as ServiceRequest['status'][]) {
      expect(isValidProcedureServiceRequest(makeStandardProcedureSR(`sr-${status}`, { status }))).toBe(true);
    }
  });

  test('excludes a procedure deleted via delete-chart-data (status=entered-in-error)', () => {
    // delete-chart-data patches a deleted procedure to entered-in-error rather
    // than deleting it, and the chart UI hides those by status - filtering them
    // out here keeps a saved template from carrying deleted procedures forward.
    const sr = makeStandardProcedureSR('sr-error', { status: 'entered-in-error' });
    expect(isValidProcedureServiceRequest(sr)).toBe(false);
  });

  test('excludes a revoked procedure', () => {
    const sr = makeStandardProcedureSR('sr-revoked', { status: 'revoked' });
    expect(isValidProcedureServiceRequest(sr)).toBe(false);
  });

  test('excludes an SR without the procedure meta tag', () => {
    // An in-house lab SR or any other ServiceRequest without the procedure
    // chart-data meta tag must not be picked up as a procedure plan.
    const sr = makeStandardProcedureSR('sr-no-tag', { meta: { tag: [] } });
    expect(isValidProcedureServiceRequest(sr)).toBe(false);
  });

  test('excludes an SR whose meta tag system is different (e.g. in-house lab plan)', () => {
    const sr = makeStandardProcedureSR('sr-lab-tag', {
      meta: { tag: [{ system: chartDataTagSystem('in-house-lab-template-plan'), code: 'in-house-lab-template-plan' }] },
    });
    expect(isValidProcedureServiceRequest(sr)).toBe(false);
  });

  test('non-ServiceRequest resource returns false', () => {
    const obs: TemplateEncounterResource = {
      resourceType: 'Observation',
      id: 'obs-1',
      status: 'final',
      code: {},
      meta: { tag: [{ system: chartDataTagSystem('procedure'), code: 'procedure' }] },
    };
    expect(isValidProcedureServiceRequest(obs)).toBe(false);
  });
});
