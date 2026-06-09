import { Patient } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { getErxPatientDemographicErrors } from './patient';

const validErxPatient = (): Patient => ({
  resourceType: 'Patient',
  name: [
    {
      given: ['John'],
      family: 'Doe',
    },
  ],
  birthDate: '1990-01-01',
  gender: 'male',
  telecom: [
    {
      system: 'phone',
      value: '(555) 555-0100',
    },
  ],
  address: [
    {
      line: ['1 Main St'],
      city: 'Anywhere',
      state: 'NY',
      postalCode: '10001',
    },
  ],
});

describe('getErxPatientDemographicErrors', () => {
  it('returns [] for a valid patient', () => {
    expect(getErxPatientDemographicErrors(validErxPatient())).toEqual([]);
  });

  it('returns ["patient"] for undefined', () => {
    expect(getErxPatientDemographicErrors(undefined)).toEqual(['patient']);
  });

  it('flags a missing name', () => {
    const patient = validErxPatient();
    patient.name = [
      {
        given: ['John'],
      },
    ];
    expect(getErxPatientDemographicErrors(patient)).toContain('name');
  });

  it('flags a missing birthDate', () => {
    const patient = validErxPatient();
    patient.birthDate = undefined;
    expect(getErxPatientDemographicErrors(patient)).toContain('birthDate');
  });

  it('flags a missing gender', () => {
    const patient = validErxPatient();
    patient.gender = undefined;
    expect(getErxPatientDemographicErrors(patient)).toContain('gender');
  });

  it('accepts a phone in arbitrary format (normalized via standardizePhoneNumber)', () => {
    const patient = validErxPatient();
    patient.telecom = [
      {
        system: 'phone',
        value: '+1 555-555-0100',
      },
    ];
    expect(getErxPatientDemographicErrors(patient)).toEqual([]);
  });

  it('flags an invalid phone (too few digits)', () => {
    const patient = validErxPatient();
    patient.telecom = [
      {
        system: 'phone',
        value: '555-0100',
      },
    ];
    expect(getErxPatientDemographicErrors(patient)).toContain('phone');
  });

  it('flags an email-only patient (eRx needs a phone)', () => {
    const patient = validErxPatient();
    patient.telecom = [
      {
        system: 'email',
        value: 'patient@example.com',
      },
    ];
    expect(getErxPatientDemographicErrors(patient)).toContain('phone');
  });

  it('flags a guardian-only contact (eRx needs a patient phone)', () => {
    const patient = validErxPatient();
    patient.telecom = [];
    patient.contact = [
      {
        telecom: [
          {
            system: 'phone',
            value: '(555) 555-0100',
          },
        ],
      },
    ];
    expect(getErxPatientDemographicErrors(patient)).toContain('phone');
  });

  it('flags an address with no state', () => {
    const patient = validErxPatient();
    patient.address = [
      {
        line: ['1 Main St'],
        city: 'Anywhere',
        postalCode: '10001',
      },
    ];
    expect(getErxPatientDemographicErrors(patient)).toContain('address');
  });

  it('flags an address missing a line', () => {
    const patient = validErxPatient();
    patient.address = [
      {
        line: [''],
        city: 'Anywhere',
        state: 'NY',
        postalCode: '10001',
      },
    ];
    expect(getErxPatientDemographicErrors(patient)).toContain('address');
  });

  it('passes when at least one address is fully valid', () => {
    const patient = validErxPatient();
    patient.address = [
      {
        line: [''],
        city: 'Anywhere',
        state: 'NY',
        postalCode: '10001',
      },
      {
        line: ['1 Main St'],
        city: 'Anywhere',
        state: 'NY',
        postalCode: '10001',
      },
    ];
    expect(getErxPatientDemographicErrors(patient)).toEqual([]);
  });

  it('reports multiple problems at once', () => {
    const patient = validErxPatient();
    patient.gender = undefined;
    patient.telecom = [];
    expect(getErxPatientDemographicErrors(patient).sort()).toEqual(['gender', 'phone'].sort());
  });
});
