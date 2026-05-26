import { Patient } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { isPatientDemographicsComplete } from './patient';

const completePatient = (): Patient => ({
  resourceType: 'Patient',
  name: [{ given: ['John'], family: 'Doe' }],
  birthDate: '1990-01-01',
  gender: 'male',
  telecom: [{ system: 'phone', value: '+15555550100' }],
  address: [{ line: ['1 Main St'], city: 'Anywhere', state: 'NY', postalCode: '10001' }],
});

describe('isPatientDemographicsComplete', () => {
  it('returns true for a fully populated patient', () => {
    expect(isPatientDemographicsComplete(completePatient())).toBe(true);
  });

  it('returns false for undefined', () => {
    expect(isPatientDemographicsComplete(undefined)).toBe(false);
  });

  it('returns false when name has no given', () => {
    const patient = completePatient();
    patient.name = [{ given: [], family: 'Doe' }];
    expect(isPatientDemographicsComplete(patient)).toBe(false);
  });

  it('returns false when name has no family', () => {
    const patient = completePatient();
    patient.name = [{ given: ['John'] }];
    expect(isPatientDemographicsComplete(patient)).toBe(false);
  });

  it('returns false when name has only whitespace', () => {
    const patient = completePatient();
    patient.name = [{ given: ['   '], family: 'Doe' }];
    expect(isPatientDemographicsComplete(patient)).toBe(false);
  });

  it('returns false when birthDate is missing', () => {
    const patient = completePatient();
    patient.birthDate = undefined;
    expect(isPatientDemographicsComplete(patient)).toBe(false);
  });

  it('returns false when gender is missing', () => {
    const patient = completePatient();
    patient.gender = undefined;
    expect(isPatientDemographicsComplete(patient)).toBe(false);
  });

  it('accepts gender "unknown"', () => {
    const patient = completePatient();
    patient.gender = 'unknown';
    expect(isPatientDemographicsComplete(patient)).toBe(true);
  });

  it('returns false when no reachable telecom anywhere', () => {
    const patient = completePatient();
    patient.telecom = [];
    expect(isPatientDemographicsComplete(patient)).toBe(false);
  });

  it('accepts email-only telecom (no phone)', () => {
    const patient = completePatient();
    patient.telecom = [{ system: 'email', value: 'patient@example.com' }];
    expect(isPatientDemographicsComplete(patient)).toBe(true);
  });

  it('ignores non-phone/email telecom systems (e.g. sms, fax)', () => {
    const patient = completePatient();
    patient.telecom = [{ system: 'sms', value: '+15555550100' }];
    expect(isPatientDemographicsComplete(patient)).toBe(false);
  });

  it('accepts guardian telecom on Patient.contact (pediatric)', () => {
    const patient = completePatient();
    patient.telecom = [];
    patient.contact = [{ telecom: [{ system: 'phone', value: '+15555550100' }] }];
    expect(isPatientDemographicsComplete(patient)).toBe(true);
  });

  it('returns false when address is missing postalCode', () => {
    const patient = completePatient();
    patient.address = [{ line: ['1 Main St'], city: 'Anywhere', state: 'NY' }];
    expect(isPatientDemographicsComplete(patient)).toBe(false);
  });

  it('returns false when address has empty line', () => {
    const patient = completePatient();
    patient.address = [{ line: [''], city: 'Anywhere', state: 'NY', postalCode: '10001' }];
    expect(isPatientDemographicsComplete(patient)).toBe(false);
  });

  it('passes when at least one of multiple addresses is complete', () => {
    const patient = completePatient();
    patient.address = [
      { line: [''], city: 'Anywhere', state: 'NY', postalCode: '10001' },
      { line: ['1 Main St'], city: 'Anywhere', state: 'NY', postalCode: '10001' },
    ];
    expect(isPatientDemographicsComplete(patient)).toBe(true);
  });
});
