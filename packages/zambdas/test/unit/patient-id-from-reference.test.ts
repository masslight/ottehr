import { describe, expect, it } from 'vitest';
import { patientIdFromReference } from '../../src/shared/helpers';

describe('patientIdFromReference', () => {
  it('reads a relative reference', () => {
    expect(patientIdFromReference('Patient/abc-123')).toBe('abc-123');
  });

  it('reads an absolute reference', () => {
    expect(patientIdFromReference('https://fhir-api.zapehr.com/r4/Patient/abc-123')).toBe('abc-123');
  });

  it('is undefined for a missing reference', () => {
    expect(patientIdFromReference(undefined)).toBeUndefined();
  });

  it('is undefined for a reference to another resource type', () => {
    expect(patientIdFromReference('Group/abc-123')).toBeUndefined();
    expect(patientIdFromReference('https://fhir-api.zapehr.com/r4/RelatedPerson/abc-123')).toBeUndefined();
  });

  it('is undefined for a bare id or a trailing slash', () => {
    expect(patientIdFromReference('abc-123')).toBeUndefined();
    expect(patientIdFromReference('Patient/')).toBeUndefined();
  });
});
