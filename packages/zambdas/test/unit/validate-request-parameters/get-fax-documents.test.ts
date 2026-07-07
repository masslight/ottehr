import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/ehr/get-fax-documents/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

const APPOINTMENT_ID = '550e8400-e29b-41d4-a716-446655440000';

describe('get-fax-documents - validateRequestParameters', () => {
  const secrets = createMockSecrets();

  test('should return validated params for a valid request', () => {
    const input = createMockZambdaInput({ appointmentId: APPOINTMENT_ID }, { secrets });
    const result = validateRequestParameters(input);

    expect(result).toEqual({ appointmentId: APPOINTMENT_ID, secrets });
  });

  test('should throw when appointmentId is not a valid UUID', () => {
    const input = createMockZambdaInput({ appointmentId: 'appt-123' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when Authorization header is missing', () => {
    const input = createMockZambdaInput({ appointmentId: APPOINTMENT_ID }, { secrets, headers: {} as any });
    expect(() => validateRequestParameters(input)).toThrow();
  });
});
