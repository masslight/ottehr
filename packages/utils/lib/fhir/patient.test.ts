import { Appointment, Encounter, Patient, Person, RelatedPerson } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import {
  findPatientForAppointment,
  findPatientForEncounter,
  findRelatedPersonForPatient,
  getAddressForIndividual,
  getEmailForIndividual,
  getFirstName,
  getFormattedPatientFullName,
  getFullName,
  getLastName,
  getMiddleName,
  getNameSuffix,
  getNickname,
  getPatientAddress,
  getPatientFirstName,
  getPatientLastName,
  getPhoneNumberForIndividual,
  getSMSNumberForIndividual,
  makeSSNIdentifier,
  mapGenderToLabel,
} from './patient';

const makePatient = (overrides: Partial<Patient> = {}): Patient => ({
  resourceType: 'Patient',
  ...overrides,
});

describe('patient', () => {
  describe('name extraction helpers', () => {
    const patient = makePatient({
      name: [
        { family: 'Smith', given: ['John', 'Michael'], suffix: ['Jr.'] },
        { given: ['Johnny'] }, // nickname name entry
      ],
    });

    it('getFirstName returns first given name', () => {
      expect(getFirstName(patient)).toBe('John');
    });

    it('getMiddleName returns second given name', () => {
      expect(getMiddleName(patient)).toBe('Michael');
    });

    it('getLastName returns family name', () => {
      expect(getLastName(patient)).toBe('Smith');
    });

    it('getNickname returns given[0] of second name entry', () => {
      expect(getNickname(patient)).toBe('Johnny');
    });

    it('getNameSuffix returns first suffix', () => {
      expect(getNameSuffix(patient)).toBe('Jr.');
    });

    it('getPatientFirstName delegates to getFirstName', () => {
      expect(getPatientFirstName(patient)).toBe('John');
    });

    it('getPatientLastName delegates to getLastName', () => {
      expect(getPatientLastName(patient)).toBe('Smith');
    });

    it('getFullName formats as "First Middle Last"', () => {
      expect(getFullName(patient)).toBe('John Michael Smith');
    });

    it('getFullName without middle name omits it', () => {
      const p = makePatient({ name: [{ family: 'Doe', given: ['Jane'] }] });
      expect(getFullName(p)).toBe('Jane Doe');
    });

    it('returns undefined for missing name', () => {
      const p = makePatient({});
      expect(getFirstName(p)).toBeUndefined();
      expect(getLastName(p)).toBeUndefined();
    });
  });

  describe('getFormattedPatientFullName', () => {
    it('should format as "Last, First"', () => {
      const p = makePatient({ name: [{ family: 'Doe', given: ['Jane'] }] });
      expect(getFormattedPatientFullName(p)).toBe('Doe, Jane');
    });

    it('should include middle name by default', () => {
      const p = makePatient({ name: [{ family: 'Doe', given: ['Jane', 'Marie'] }] });
      expect(getFormattedPatientFullName(p)).toBe('Doe, Jane, Marie');
    });

    it('should skip middle name when option set', () => {
      const p = makePatient({ name: [{ family: 'Doe', given: ['Jane', 'Marie'] }] });
      expect(getFormattedPatientFullName(p, { skipMiddleName: true })).toBe('Doe, Jane');
    });

    it('should include nickname by default', () => {
      const p = makePatient({
        name: [{ family: 'Doe', given: ['Jane'] }, { given: ['Jenny'] }],
      });
      expect(getFormattedPatientFullName(p)).toBe('Doe, Jane (Jenny)');
    });

    it('should skip nickname when option set', () => {
      const p = makePatient({
        name: [{ family: 'Doe', given: ['Jane'] }, { given: ['Jenny'] }],
      });
      expect(getFormattedPatientFullName(p, { skipNickname: true })).toBe('Doe, Jane');
    });

    it('should return undefined when no first or last name', () => {
      const p = makePatient({});
      expect(getFormattedPatientFullName(p)).toBeUndefined();
    });

    it('should handle only first name', () => {
      const p = makePatient({ name: [{ given: ['Jane'] }] });
      expect(getFormattedPatientFullName(p)).toBe('Jane');
    });

    it('should handle only last name', () => {
      const p = makePatient({ name: [{ family: 'Doe' }] });
      expect(getFormattedPatientFullName(p)).toBe('Doe');
    });
  });

  describe('telecom helpers', () => {
    it('getSMSNumberForIndividual should find sms number starting with +', () => {
      const person = {
        resourceType: 'Person',
        telecom: [
          { system: 'phone', value: '5551234567' },
          { system: 'sms', value: '+15551234567' },
        ],
      } as unknown as Person;
      expect(getSMSNumberForIndividual(person)).toBe('+15551234567');
    });

    it('getSMSNumberForIndividual should return undefined when no sms with +', () => {
      const person = {
        resourceType: 'Person',
        telecom: [{ system: 'sms', value: '5551234567' }],
      } as unknown as Person;
      expect(getSMSNumberForIndividual(person)).toBeUndefined();
    });

    it('getPhoneNumberForIndividual should find phone number', () => {
      const patient = {
        resourceType: 'Patient',
        telecom: [
          { system: 'email', value: 'test@test.com' },
          { system: 'phone', value: '+15551234567' },
        ],
      } as unknown as Patient;
      expect(getPhoneNumberForIndividual(patient)).toBe('+15551234567');
    });

    it('getEmailForIndividual should find email', () => {
      const patient = {
        resourceType: 'Patient',
        telecom: [
          { system: 'phone', value: '+15551234567' },
          { system: 'email', value: 'test@example.com' },
        ],
      } as unknown as Patient;
      expect(getEmailForIndividual(patient)).toBe('test@example.com');
    });

    it('should return undefined when telecom is missing', () => {
      const patient = { resourceType: 'Patient' } as unknown as Patient;
      expect(getSMSNumberForIndividual(patient)).toBeUndefined();
      expect(getPhoneNumberForIndividual(patient)).toBeUndefined();
      expect(getEmailForIndividual(patient)).toBeUndefined();
    });
  });

  describe('getAddressForIndividual', () => {
    it('should return address without end period', () => {
      const patient = {
        resourceType: 'Patient',
        address: [
          { line: ['old addr'], period: { end: '2020-01-01' } },
          { line: ['123 Main St'], city: 'Anytown' },
        ],
      } as unknown as Patient;
      const addr = getAddressForIndividual(patient);
      expect(addr?.line?.[0]).toBe('123 Main St');
    });

    it('should return undefined when all addresses have ended', () => {
      const patient = {
        resourceType: 'Patient',
        address: [{ line: ['old'], period: { end: '2020-01-01' } }],
      } as unknown as Patient;
      expect(getAddressForIndividual(patient)).toBeUndefined();
    });
  });

  describe('getPatientAddress', () => {
    it('should extract address components from first address', () => {
      const address: Patient['address'] = [
        {
          line: ['123 Main St', 'Apt 4'],
          city: 'Springfield',
          state: 'IL',
          postalCode: '62704',
        },
      ];
      const result = getPatientAddress(address);
      expect(result.addressLine).toBe('123 Main St');
      expect(result.addressLine2).toBe('Apt 4');
      expect(result.city).toBe('Springfield');
      expect(result.state).toBe('IL');
      expect(result.postalCode).toBe('62704');
      expect(result.cityStateZIP).toBe('Springfield, IL, 62704');
    });

    it('should handle undefined address', () => {
      const result = getPatientAddress(undefined);
      expect(result.city).toBeUndefined();
      expect(result.addressLine).toBeUndefined();
      expect(result.cityStateZIP).toBe('');
    });

    it('should filter empty parts from cityStateZIP', () => {
      const address: Patient['address'] = [{ city: 'Springfield' }];
      const result = getPatientAddress(address);
      expect(result.cityStateZIP).toBe('Springfield');
    });
  });

  describe('findPatientForAppointment', () => {
    const patients = [makePatient({ id: 'p1' }), makePatient({ id: 'p2' })];

    it('should find the patient matching the appointment participant', () => {
      const appointment = {
        participant: [{ actor: { reference: 'Patient/p2' } }],
      } as unknown as Appointment;
      expect(findPatientForAppointment(appointment, patients)?.id).toBe('p2');
    });

    it('should return undefined when no patient matches', () => {
      const appointment = {
        participant: [{ actor: { reference: 'Patient/p99' } }],
      } as unknown as Appointment;
      expect(findPatientForAppointment(appointment, patients)).toBeUndefined();
    });

    it('should ignore non-Patient participants', () => {
      const appointment = {
        participant: [{ actor: { reference: 'Practitioner/prac1' } }, { actor: { reference: 'Patient/p1' } }],
      } as unknown as Appointment;
      expect(findPatientForAppointment(appointment, patients)?.id).toBe('p1');
    });

    it('should return undefined when participant is missing', () => {
      const appointment = {} as Appointment;
      expect(findPatientForAppointment(appointment, patients)).toBeUndefined();
    });
  });

  describe('findPatientForEncounter', () => {
    const patients = [makePatient({ id: 'p1' }), makePatient({ id: 'p2' })];

    it('should find patient by participant reference', () => {
      const encounter = {
        participant: [{ individual: { reference: 'Patient/p2' } }],
      } as unknown as Encounter;
      expect(findPatientForEncounter(encounter, patients)?.id).toBe('p2');
    });

    it('should return undefined when no patient reference in participants', () => {
      const encounter = {
        participant: [{ individual: { reference: 'Practitioner/prac1' } }],
      } as unknown as Encounter;
      expect(findPatientForEncounter(encounter, patients)).toBeUndefined();
    });
  });

  describe('findRelatedPersonForPatient', () => {
    it('should find related person for a patient', () => {
      const patient = makePatient({ id: 'p1' });
      const relatedPersons = [
        { id: 'rp1', patient: { reference: 'Patient/p1' } },
        { id: 'rp2', patient: { reference: 'Patient/p2' } },
      ] as unknown as RelatedPerson[];
      expect(findRelatedPersonForPatient(patient, relatedPersons)?.id).toBe('rp1');
    });
  });

  describe('makeSSNIdentifier', () => {
    it('should create a valid SSN identifier', () => {
      const result = makeSSNIdentifier('123-45-6789');
      expect(result.system).toBe('http://hl7.org/fhir/sid/us-ssn');
      expect(result.value).toBe('123-45-6789');
      expect(result.type?.coding?.[0].code).toBe('SS');
    });
  });

  describe('mapGenderToLabel', () => {
    it('should map FHIR gender codes to display labels', () => {
      expect(mapGenderToLabel.male).toBe('Male');
      expect(mapGenderToLabel.female).toBe('Female');
      expect(mapGenderToLabel.other).toBe('Intersex');
      expect(mapGenderToLabel.unknown).toBe('Unknown');
    });
  });
});
