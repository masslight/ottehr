import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/patient/appointment/prebook-cancel-appointment/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

const VALID_APPOINTMENT_ID = '550e8400-e29b-41d4-a716-446655440000';

describe('prebook-cancel-appointment - validateRequestParameters', () => {
  const secrets = createMockSecrets();

  test('should return validated params for a valid request', () => {
    const input = createMockZambdaInput(
      {
        appointmentID: VALID_APPOINTMENT_ID,
        cancellationReason: 'patient-request',
      },
      { secrets }
    );
    const result = validateRequestParameters(input);
    expect(result).toEqual({
      appointmentID: VALID_APPOINTMENT_ID,
      cancellationReason: 'patient-request',
      silent: undefined,
      language: undefined,
      cancellationReasonAdditional: undefined,
      secrets,
    });
  });

  test('should return validated params including optional fields', () => {
    const input = createMockZambdaInput(
      {
        appointmentID: VALID_APPOINTMENT_ID,
        cancellationReason: 'patient-request',
        silent: true,
        language: 'es',
        cancellationReasonAdditional: 'Some extra detail',
      },
      { secrets }
    );
    const result = validateRequestParameters(input);
    expect(result.silent).toBe(true);
    expect(result.language).toBe('es');
    expect(result.cancellationReasonAdditional).toBe('Some extra detail');
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when appointmentID is missing', () => {
    const input = createMockZambdaInput({ cancellationReason: 'patient-request' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when cancellationReason is missing', () => {
    const input = createMockZambdaInput({ appointmentID: VALID_APPOINTMENT_ID }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when appointmentID is not a valid UUID', () => {
    const input = createMockZambdaInput(
      { appointmentID: 'not-a-uuid', cancellationReason: 'patient-request' },
      { secrets }
    );
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when cancellationReason is an empty string', () => {
    const input = createMockZambdaInput({ appointmentID: VALID_APPOINTMENT_ID, cancellationReason: '' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });
});
