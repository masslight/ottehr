import { CodeableConcept } from 'fhir/r4b';
import { describe, expect, test } from 'vitest';
import { buildReasonCodeOperation } from '../../src/ehr/radiology/save-preliminary-report';

const reasonCode: CodeableConcept[] = [
  { coding: [{ code: 'E11.9', display: 'Type 2 diabetes mellitus', system: 'http://hl7.org/fhir/sid/icd-10-cm' }] },
];

// Diagnosis is optional on the preliminary read, so the order's reasonCode may need adding, replacing,
// clearing or leaving alone.
describe('buildReasonCodeOperation', () => {
  test('adds the diagnoses when the order has none', () => {
    expect(buildReasonCodeOperation(reasonCode, false)).toEqual({ op: 'add', path: '/reasonCode', value: reasonCode });
  });

  test('replaces the diagnoses already on the order', () => {
    expect(buildReasonCodeOperation(reasonCode, true)).toEqual({
      op: 'replace',
      path: '/reasonCode',
      value: reasonCode,
    });
  });

  test('removes the diagnoses already on the order when none are saved, rather than writing an empty array', () => {
    expect(buildReasonCodeOperation([], true)).toEqual({ op: 'remove', path: '/reasonCode' });
  });

  test('does nothing when neither the order nor the read has a diagnosis', () => {
    expect(buildReasonCodeOperation([], false)).toBeUndefined();
  });
});
