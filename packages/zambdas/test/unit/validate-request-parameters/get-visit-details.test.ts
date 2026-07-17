import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/patient/appointment/get-visit-details/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('get-visit-details - validateRequestParameters', () => {
  const secrets = createMockSecrets();

  test('should return validated params for a valid request', () => {
    const input = createMockZambdaInput({ appointmentId: '550e8400-e29b-41d4-a716-446655440000' }, { secrets });
    const result = validateRequestParameters(input);
    expect(result).toEqual({
      appointmentId: '550e8400-e29b-41d4-a716-446655440000',
      secrets,
    });
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when appointmentId is missing', () => {
    const input = createMockZambdaInput({}, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when appointmentId is not a valid UUID', () => {
    const input = createMockZambdaInput({ appointmentId: 'appt-not-a-uuid' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });
});
