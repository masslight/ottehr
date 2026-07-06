import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/patient/appointment/get-past-visits/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('get-past-visits - validateRequestParameters', () => {
  const secrets = createMockSecrets();

  test('should return validated params for a valid request with no body', () => {
    const input = createMockZambdaInput(null, { secrets });
    const result = validateRequestParameters(input);
    expect(result).toEqual({ patientId: undefined, secrets });
  });

  test('should return validated params for a valid request with empty body object', () => {
    const input = createMockZambdaInput({}, { secrets });
    const result = validateRequestParameters(input);
    expect(result).toEqual({ patientId: undefined, secrets });
  });

  test('should return validated params for a valid request with a patientId', () => {
    const input = createMockZambdaInput({ patientId: '550e8400-e29b-41d4-a716-446655440000' }, { secrets });
    const result = validateRequestParameters(input);
    expect(result).toEqual({
      patientId: '550e8400-e29b-41d4-a716-446655440000',
      secrets,
    });
  });

  test('should throw when patientId is not a valid UUID', () => {
    const input = createMockZambdaInput({ patientId: 'not-a-uuid' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });
});
