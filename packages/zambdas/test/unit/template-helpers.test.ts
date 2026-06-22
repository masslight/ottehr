import { Condition, Observation, Procedure } from 'fhir/r4b';
import { chartDataTagSystem, ICD_10_CODE_SYSTEM } from 'utils';
import { describe, expect, test } from 'vitest';
import { hasTemplateRelevantTag, isDiagnosisCondition } from '../../src/ehr/shared/template-helpers';

const taggedCondition = (tagField: string, opts: { withIcd10?: boolean } = {}): Condition => ({
  resourceType: 'Condition',
  subject: { reference: 'Patient/p1' },
  encounter: { reference: 'Encounter/e1' },
  meta: { tag: [{ system: chartDataTagSystem(tagField), code: tagField }] },
  code: opts.withIcd10
    ? { coding: [{ system: ICD_10_CODE_SYSTEM, code: 'J45.909', display: 'Unspecified asthma, uncomplicated' }] }
    : undefined,
});

describe('isDiagnosisCondition', () => {
  test('returns true for a Condition tagged `diagnosis` with an ICD-10 code', () => {
    expect(isDiagnosisCondition(taggedCondition('diagnosis', { withIcd10: true }))).toBe(true);
  });

  test('returns false for a Medical Condition (Condition tagged `medical-condition`) even when it carries an ICD-10 code', () => {
    // This is the bug we are guarding against: Medical Conditions can carry ICD-10 codes (the UI lets users pick one),
    // and the previous discriminator (presence of ICD-10 code) would surface them as diagnoses incorrectly.
    expect(isDiagnosisCondition(taggedCondition('medical-condition', { withIcd10: true }))).toBe(false);
  });

  test('returns false for a Medical Condition without any ICD-10 code', () => {
    expect(isDiagnosisCondition(taggedCondition('medical-condition'))).toBe(false);
  });

  test('returns false for a Condition with no meta tag', () => {
    const cond: Condition = {
      resourceType: 'Condition',
      subject: { reference: 'Patient/p1' },
      code: { coding: [{ system: ICD_10_CODE_SYSTEM, code: 'J45.909' }] },
    };
    expect(isDiagnosisCondition(cond)).toBe(false);
  });

  test('returns false for non-Condition resources', () => {
    const obs: Observation = {
      resourceType: 'Observation',
      status: 'final',
      code: { coding: [] },
      meta: { tag: [{ system: chartDataTagSystem('diagnosis'), code: 'diagnosis' }] },
    };
    expect(isDiagnosisCondition(obs)).toBe(false);
  });

  test('returns false for undefined resource', () => {
    expect(isDiagnosisCondition(undefined)).toBe(false);
  });
});

describe('hasTemplateRelevantTag', () => {
  test.each([
    'chief-complaint',
    'mechanism-of-injury',
    'ros',
    'exam-observation-field',
    'ros-observation-field',
    'medical-decision',
    'patient-instruction',
    'cpt-code',
    'em-code',
    'diagnosis',
  ])('returns true for a resource tagged `%s`', (tagField) => {
    const resource: Observation = {
      resourceType: 'Observation',
      status: 'final',
      code: { coding: [] },
      meta: { tag: [{ system: chartDataTagSystem(tagField), code: tagField }] },
    };
    expect(hasTemplateRelevantTag(resource)).toBe(true);
  });

  test('returns false for a Medical Condition (the bug scenario)', () => {
    expect(hasTemplateRelevantTag(taggedCondition('medical-condition', { withIcd10: true }))).toBe(false);
    expect(hasTemplateRelevantTag(taggedCondition('medical-condition'))).toBe(false);
  });

  test('returns false for resources tagged with unrelated chart-data fields', () => {
    expect(hasTemplateRelevantTag(taggedCondition('known-allergy'))).toBe(false);
    expect(hasTemplateRelevantTag(taggedCondition('surgical-history'))).toBe(false);
    expect(hasTemplateRelevantTag(taggedCondition('hospitalization'))).toBe(false);
  });

  test('returns false for a resource with no meta tag', () => {
    const proc: Procedure = {
      resourceType: 'Procedure',
      status: 'completed',
      subject: { reference: 'Patient/p1' },
    };
    expect(hasTemplateRelevantTag(proc)).toBe(false);
  });

  test('returns false for undefined resource', () => {
    expect(hasTemplateRelevantTag(undefined)).toBe(false);
  });

  test('returns true if any one tag matches (resource may carry multiple tags)', () => {
    const resource: Procedure = {
      resourceType: 'Procedure',
      status: 'completed',
      subject: { reference: 'Patient/p1' },
      meta: {
        tag: [
          { system: 'https://example.com/unrelated', code: 'foo' },
          { system: chartDataTagSystem('cpt-code'), code: 'cpt-code' },
        ],
      },
    };
    expect(hasTemplateRelevantTag(resource)).toBe(true);
  });
});
