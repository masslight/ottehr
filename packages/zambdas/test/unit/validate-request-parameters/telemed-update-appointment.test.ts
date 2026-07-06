import { describe, expect, test } from 'vitest';
import { validateUpdateAppointmentParams } from '../../../src/patient/appointment/telemed-update-appointment/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('telemed-update-appointment - validateUpdateAppointmentParams', () => {
  const secrets = createMockSecrets();

  const validPatient = {
    firstName: 'Jane',
    lastName: 'Doe',
    dateOfBirth: '1990-05-15',
    email: 'jane.doe@example.com',
    emailUser: 'Patient',
    sex: 'female',
    phoneNumber: '2125551234',
  };

  const validBody = {
    appointmentId: '550e8400-e29b-41d4-a716-446655440000',
    patient: validPatient,
    locationState: 'NY',
  };

  test('should return validated params for a valid request', () => {
    const input = createMockZambdaInput(validBody, { secrets });
    const result = validateUpdateAppointmentParams(input);

    expect(result.appointmentId).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(result.patient.firstName).toBe('Jane');
    expect(result.patient.email).toBe('jane.doe@example.com');
    expect(result.locationState).toBe('NY');
    expect(result.secrets).toBe(secrets);
  });

  test('should return validated params with Parent/Guardian emailUser', () => {
    const input = createMockZambdaInput(
      { ...validBody, patient: { ...validPatient, emailUser: 'Parent/Guardian' } },
      { secrets }
    );
    const result = validateUpdateAppointmentParams(input);
    expect((result.patient as { emailUser?: string }).emailUser).toBe('Parent/Guardian');
  });

  test('should return validated params without optional locationState', () => {
    const { locationState: _, ...bodyWithoutState } = validBody;
    const input = createMockZambdaInput(bodyWithoutState, { secrets });
    const result = validateUpdateAppointmentParams(input);

    expect(result.locationState).toBeUndefined();
  });

  test('should return validated params without optional sex and phoneNumber', () => {
    const { sex: _, phoneNumber: __, ...patientWithoutOptionals } = validPatient;
    const input = createMockZambdaInput({ ...validBody, patient: patientWithoutOptionals }, { secrets });
    const result = validateUpdateAppointmentParams(input);

    expect(result.patient.firstName).toBe('Jane');
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { secrets });
    expect(() => validateUpdateAppointmentParams(input)).toThrow();
  });

  test('should throw when appointmentId is missing', () => {
    const { appointmentId: _, ...rest } = validBody;
    const input = createMockZambdaInput(rest, { secrets });
    expect(() => validateUpdateAppointmentParams(input)).toThrow();
  });

  test('should throw when patient is missing', () => {
    const { patient: _, ...rest } = validBody;
    const input = createMockZambdaInput(rest, { secrets });
    expect(() => validateUpdateAppointmentParams(input)).toThrow();
  });

  test('should throw when appointmentId is not a valid UUID', () => {
    const input = createMockZambdaInput({ ...validBody, appointmentId: 'appt-not-uuid' }, { secrets });
    expect(() => validateUpdateAppointmentParams(input)).toThrow();
  });

  test('should throw when patient.firstName is missing', () => {
    const { firstName: _, ...patientWithout } = validPatient;
    const input = createMockZambdaInput({ ...validBody, patient: patientWithout }, { secrets });
    expect(() => validateUpdateAppointmentParams(input)).toThrow();
  });

  test('should throw when patient.lastName is missing', () => {
    const { lastName: _, ...patientWithout } = validPatient;
    const input = createMockZambdaInput({ ...validBody, patient: patientWithout }, { secrets });
    expect(() => validateUpdateAppointmentParams(input)).toThrow();
  });

  test('should throw when patient.dateOfBirth is missing', () => {
    const { dateOfBirth: _, ...patientWithout } = validPatient;
    const input = createMockZambdaInput({ ...validBody, patient: patientWithout }, { secrets });
    expect(() => validateUpdateAppointmentParams(input)).toThrow();
  });

  test('should throw when patient.email is missing', () => {
    const { email: _, ...patientWithout } = validPatient;
    const input = createMockZambdaInput({ ...validBody, patient: patientWithout }, { secrets });
    expect(() => validateUpdateAppointmentParams(input)).toThrow();
  });

  test('should throw when patient.emailUser is missing', () => {
    const { emailUser: _, ...patientWithout } = validPatient;
    const input = createMockZambdaInput({ ...validBody, patient: patientWithout }, { secrets });
    expect(() => validateUpdateAppointmentParams(input)).toThrow();
  });

  test('should throw when patient.emailUser is invalid enum value', () => {
    const input = createMockZambdaInput(
      { ...validBody, patient: { ...validPatient, emailUser: 'Doctor' } },
      { secrets }
    );
    expect(() => validateUpdateAppointmentParams(input)).toThrow();
  });

  test('should throw when patient.sex is an invalid enum value', () => {
    const input = createMockZambdaInput({ ...validBody, patient: { ...validPatient, sex: 'unknown' } }, { secrets });
    expect(() => validateUpdateAppointmentParams(input)).toThrow();
  });

  test('should throw when patient.dateOfBirth is not a valid date', () => {
    const input = createMockZambdaInput(
      { ...validBody, patient: { ...validPatient, dateOfBirth: 'not-a-date' } },
      { secrets }
    );
    expect(() => validateUpdateAppointmentParams(input)).toThrow();
  });

  test('should throw when patient.phoneNumber is not a valid phone number', () => {
    const input = createMockZambdaInput(
      { ...validBody, patient: { ...validPatient, phoneNumber: '123' } },
      { secrets }
    );
    expect(() => validateUpdateAppointmentParams(input)).toThrow();
  });

  test('should throw when patient.firstName is empty string', () => {
    const input = createMockZambdaInput({ ...validBody, patient: { ...validPatient, firstName: '' } }, { secrets });
    expect(() => validateUpdateAppointmentParams(input)).toThrow();
  });

  test('should accept second valid UUID for appointmentId', () => {
    const input = createMockZambdaInput(
      { ...validBody, appointmentId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8' },
      { secrets }
    );
    const result = validateUpdateAppointmentParams(input);
    expect(result.appointmentId).toBe('6ba7b810-9dad-11d1-80b4-00c04fd430c8');
  });
});
