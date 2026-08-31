import { Patient } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { getPatientFriendlyId } from './patient';

const FRIENDLY_ID_SYSTEM = 'https://identifiers.fhir.oystehr.com/friendly-patient-id/test-project';

describe('getPatientFriendlyId', () => {
  it('returns the friendly PID when identifier exists', () => {
    const patient: Patient = {
      resourceType: 'Patient',
      identifier: [{ system: FRIENDLY_ID_SYSTEM, value: '1234' }],
    };
    expect(getPatientFriendlyId(patient)).toBe('1234');
  });

  it('returns empty string when no identifier array exists', () => {
    const patient: Patient = { resourceType: 'Patient' };
    expect(getPatientFriendlyId(patient)).toBe('');
  });

  it('returns empty string when no matching identifier system exists', () => {
    const patient: Patient = {
      resourceType: 'Patient',
      identifier: [{ system: 'https://other.system', value: 'other-value' }],
    };
    expect(getPatientFriendlyId(patient)).toBe('');
  });

  it('does not fall back to patient.id when friendly PID is missing', () => {
    const patient: Patient = {
      resourceType: 'Patient',
      id: 'some-uuid-123',
    };
    expect(getPatientFriendlyId(patient)).toBe('');
  });

  it('returns first matching identifier when multiple identifiers exist', () => {
    const patient: Patient = {
      resourceType: 'Patient',
      identifier: [
        { system: 'https://other.system', value: 'other' },
        { system: FRIENDLY_ID_SYSTEM, value: '5678' },
      ],
    };
    expect(getPatientFriendlyId(patient)).toBe('5678');
  });
});
