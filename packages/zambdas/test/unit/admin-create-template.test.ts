import { Condition, Encounter, Observation } from 'fhir/r4b';
import { chartDataTagSystem, ICD_10_CODE_SYSTEM } from 'utils';
import { describe, expect, test } from 'vitest';
import { filterEntriesToTemplateContent } from '../../src/ehr/admin-create-template/index';
import { TemplateEncounterResource } from '../../src/ehr/shared/template-helpers';

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
