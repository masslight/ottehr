import { User } from '@oystehr/sdk';
import { APIErrorCode } from 'utils/lib/types/errors';
import { describe, expect, test } from 'vitest';
import { validateCreateAppointmentParams } from '../../src/patient/appointment/create-appointment/validateRequestParameters';
import { creatingPatientCreateRequest } from '../../src/shared/appointment/helpers';
import { createMockSecrets, createMockZambdaInput } from './validate-request-parameters/helpers';

const VALID_SLOT_ID = '550e8400-e29b-41d4-a716-446655440000';

const ehrUser: User = {
  id: 'ehr-user-id',
  name: 'Dr. Provider',
  email: 'provider@clinic.com',
  phoneNumber: null,
  authenticationMethod: 'email',
  profile: 'Practitioner/some-id',
};

const validPatient = {
  firstName: 'John',
  lastName: 'Doe',
  dateOfBirth: '1990-01-15',
  sex: 'male',
  reasonForVisit: 'Cough',
};

const validate = (patient: Record<string, unknown>): ReturnType<typeof validateCreateAppointmentParams>['patient'] =>
  validateCreateAppointmentParams(
    createMockZambdaInput({ slotId: VALID_SLOT_ID, patient }, { secrets: createMockSecrets() }),
    { user: ehrUser }
  ).patient;

describe('create-appointment blank patient text', () => {
  test.each(['firstName', 'lastName'])('rejects a whitespace-only patient.%s as a missing parameter', (field) => {
    expect(() => validate({ ...validPatient, [field]: '   ' })).toThrow(
      expect.objectContaining({
        code: APIErrorCode.MISSING_REQUIRED_PARAMETERS,
        message: expect.stringContaining(`patient.${field}`),
      })
    );
  });

  test('trims surrounding whitespace from the first and last name', () => {
    const patient = validate({ ...validPatient, firstName: '  John ', lastName: ' Doe  ' });
    expect(patient.firstName).toBe('John');
    expect(patient.lastName).toBe('Doe');
  });

  test.each(['middleName', 'chosenName', 'authorizedNonLegalGuardians'])(
    'turns a whitespace-only patient.%s into undefined while keeping it provided',
    (field) => {
      const patient = validate({ ...validPatient, [field]: ' \n ' }) as Record<string, unknown>;
      expect(field in patient).toBe(true);
      expect(patient[field]).toBeUndefined();
    }
  );

  test('keeps non-blank optional names', () => {
    const patient = validate({ ...validPatient, middleName: 'Q', chosenName: 'Johnny' });
    expect(patient.middleName).toBe('Q');
    expect(patient.chosenName).toBe('Johnny');
  });

  test('builds a new Patient without blank names from a validated body', () => {
    const patient = validate({ ...validPatient, middleName: '  ', chosenName: '  ', authorizedNonLegalGuardians: ' ' });
    const resource = creatingPatientCreateRequest(patient, true)!.resource!;
    expect(resource.name).toEqual([{ given: ['John'], family: 'Doe', use: 'official' }]);
    expect(resource.extension).toBeUndefined();
  });
});
