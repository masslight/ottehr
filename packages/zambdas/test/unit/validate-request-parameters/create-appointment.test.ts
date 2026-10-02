import { User } from '@oystehr/sdk';
import { APIErrorCode } from 'utils/lib/types/errors';
import { describe, expect, test } from 'vitest';
import { validateCreateAppointmentParams } from '../../../src/patient/appointment/create-appointment/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

const VALID_SLOT_ID = '550e8400-e29b-41d4-a716-446655440000';

// Patient user: name starts with '+', not an EHR user → email is required
const mockPatientUser: User = {
  id: 'patient-user-id',
  name: '+15555555555',
  email: 'patient@example.com',
  phoneNumber: '+15555555555',
  authenticationMethod: 'sms',
  profile: 'Patient/some-id',
};

// EHR user: name does NOT start with '+' → email is not required
const mockEHRUser: User = {
  id: 'ehr-user-id',
  name: 'Dr. Provider',
  email: 'provider@clinic.com',
  phoneNumber: null,
  authenticationMethod: 'email',
  profile: 'Practitioner/some-id',
};

const validPatientBody = {
  firstName: 'John',
  lastName: 'Doe',
  dateOfBirth: '1990-01-15',
  sex: 'male',
  reasonForVisit: 'Cough',
  email: 'john@example.com',
};

describe('create-appointment - validateCreateAppointmentParams', () => {
  const secrets = createMockSecrets();

  test('should return validated params for a valid patient-user request', () => {
    const input = createMockZambdaInput({ slotId: VALID_SLOT_ID, patient: validPatientBody }, { secrets });
    const result = validateCreateAppointmentParams(input, mockPatientUser, false);
    expect(result.slotId).toBe(VALID_SLOT_ID);
    expect(result.secrets).toEqual(secrets);
    expect(result.isEHRUser).toBe(false);
  });

  test('should return validated params for a valid EHR-user request (email not required)', () => {
    const patientNoEmail = { ...validPatientBody };
    delete (patientNoEmail as any).email;
    const input = createMockZambdaInput({ slotId: VALID_SLOT_ID, patient: patientNoEmail }, { secrets });
    const result = validateCreateAppointmentParams(input, mockEHRUser, false);
    expect(result.slotId).toBe(VALID_SLOT_ID);
    expect(result.isEHRUser).toBe(true);
  });

  test('should accept optional language "en"', () => {
    const input = createMockZambdaInput(
      { slotId: VALID_SLOT_ID, patient: validPatientBody, language: 'en' },
      { secrets }
    );
    const result = validateCreateAppointmentParams(input, mockPatientUser, false);
    expect(result.language).toBe('en');
  });

  test('should accept optional language "es"', () => {
    const input = createMockZambdaInput(
      { slotId: VALID_SLOT_ID, patient: validPatientBody, language: 'es' },
      { secrets }
    );
    const result = validateCreateAppointmentParams(input, mockPatientUser, false);
    expect(result.language).toBe('es');
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { secrets });
    expect(() => validateCreateAppointmentParams(input, mockPatientUser, false)).toThrow();
  });

  test('should throw when slotId is missing', () => {
    const input = createMockZambdaInput({ patient: validPatientBody }, { secrets });
    expect(() => validateCreateAppointmentParams(input, mockPatientUser, false)).toThrow();
  });

  test('should throw when patient is missing', () => {
    const input = createMockZambdaInput({ slotId: VALID_SLOT_ID }, { secrets });
    expect(() => validateCreateAppointmentParams(input, mockPatientUser, false)).toThrow();
  });

  test('should throw when slotId is not a valid UUID', () => {
    const input = createMockZambdaInput({ slotId: 'not-a-uuid', patient: validPatientBody }, { secrets });
    expect(() => validateCreateAppointmentParams(input, mockPatientUser, false)).toThrow();
  });

  test('should throw when patient.firstName is missing', () => {
    const { firstName: _removed, ...patientWithout } = validPatientBody as any;
    const input = createMockZambdaInput({ slotId: VALID_SLOT_ID, patient: patientWithout }, { secrets });
    expect(() => validateCreateAppointmentParams(input, mockPatientUser, false)).toThrow();
  });

  test('should throw when patient.lastName is missing', () => {
    const { lastName: _removed, ...patientWithout } = validPatientBody as any;
    const input = createMockZambdaInput({ slotId: VALID_SLOT_ID, patient: patientWithout }, { secrets });
    expect(() => validateCreateAppointmentParams(input, mockPatientUser, false)).toThrow();
  });

  test('should throw when patient.dateOfBirth is missing', () => {
    const { dateOfBirth: _removed, ...patientWithout } = validPatientBody as any;
    const input = createMockZambdaInput({ slotId: VALID_SLOT_ID, patient: patientWithout }, { secrets });
    expect(() => validateCreateAppointmentParams(input, mockPatientUser, false)).toThrow();
  });

  test('should throw when patient.sex is missing', () => {
    const { sex: _removed, ...patientWithout } = validPatientBody as any;
    const input = createMockZambdaInput({ slotId: VALID_SLOT_ID, patient: patientWithout }, { secrets });
    expect(() => validateCreateAppointmentParams(input, mockPatientUser, false)).toThrow();
  });

  test('should throw when patient.email is missing for patient user', () => {
    const { email: _removed, ...patientWithout } = validPatientBody as any;
    const input = createMockZambdaInput({ slotId: VALID_SLOT_ID, patient: patientWithout }, { secrets });
    expect(() => validateCreateAppointmentParams(input, mockPatientUser, false)).toThrow();
  });

  test('should throw when patient.dateOfBirth is an invalid date', () => {
    const input = createMockZambdaInput(
      { slotId: VALID_SLOT_ID, patient: { ...validPatientBody, dateOfBirth: 'not-a-date' } },
      { secrets }
    );
    expect(() => validateCreateAppointmentParams(input, mockPatientUser, false)).toThrow();
  });

  // Luxon reads these as valid dates, so they used to pass validation and only fail at the FHIR
  // write, where `Invalid date format - POST /Patient` surfaced to the caller as a 500.
  test.each(['19900115', '1990-015', '1990-W03-1', '+001990-01-15', '1990-01-15 10:00'])(
    'should reject %s as patient.dateOfBirth, which FHIR would not accept as a date',
    (dateOfBirth) => {
      const input = createMockZambdaInput(
        { slotId: VALID_SLOT_ID, patient: { ...validPatientBody, dateOfBirth } },
        { secrets }
      );
      expect(() => validateCreateAppointmentParams(input, mockPatientUser, false)).toThrow(
        expect.objectContaining({ code: APIErrorCode.INVALID_INPUT })
      );
    }
  );

  test('should throw when patient.dateOfBirth is not a string', () => {
    const input = createMockZambdaInput(
      { slotId: VALID_SLOT_ID, patient: { ...validPatientBody, dateOfBirth: 19900115 } },
      { secrets }
    );
    expect(() => validateCreateAppointmentParams(input, mockPatientUser, false)).toThrow(
      expect.objectContaining({ code: APIErrorCode.INVALID_INPUT })
    );
  });

  // Partial dates and datetimes reached FHIR fine before the gate was tightened; keep them working.
  test.each(['1990-01-15', '1990-01', '1990', '1990-01-15T00:00:00.000Z'])(
    'should accept %s as patient.dateOfBirth',
    (dateOfBirth) => {
      const input = createMockZambdaInput(
        { slotId: VALID_SLOT_ID, patient: { ...validPatientBody, dateOfBirth } },
        { secrets }
      );
      expect(() => validateCreateAppointmentParams(input, mockPatientUser, false)).not.toThrow();
    }
  );

  test('should throw when patient.sex is an invalid enum value', () => {
    const input = createMockZambdaInput(
      { slotId: VALID_SLOT_ID, patient: { ...validPatientBody, sex: 'invalid-sex' } },
      { secrets }
    );
    expect(() => validateCreateAppointmentParams(input, mockPatientUser, false)).toThrow();
  });

  test('should throw when language is not "en" or "es"', () => {
    const input = createMockZambdaInput(
      { slotId: VALID_SLOT_ID, patient: validPatientBody, language: 'fr' },
      { secrets }
    );
    expect(() => validateCreateAppointmentParams(input, mockPatientUser, false)).toThrow();
  });
});
