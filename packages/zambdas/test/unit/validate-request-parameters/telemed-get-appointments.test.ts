import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/patient/appointment/telemed-get-appointments/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('telemed-get-appointments - validateRequestParameters', () => {
  const secrets = createMockSecrets();

  test('should return validated params with optional patientId provided', () => {
    const input = createMockZambdaInput({ patientId: '550e8400-e29b-41d4-a716-446655440000' }, { secrets });
    const result = validateRequestParameters(input);

    expect(result.patientId).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(result.secrets).toBe(secrets);
  });

  test('should return validated params when patientId is omitted', () => {
    const input = createMockZambdaInput({}, { secrets });
    const result = validateRequestParameters(input);

    expect(result.patientId).toBeUndefined();
    expect(result.secrets).toBe(secrets);
  });

  test('should return validated params when body is null (no body)', () => {
    const input = createMockZambdaInput(null, { secrets });
    const result = validateRequestParameters(input);

    expect(result.patientId).toBeUndefined();
    expect(result.secrets).toBe(secrets);
  });

  test('should throw when patientId is not a valid UUID', () => {
    const input = createMockZambdaInput({ patientId: 'not-a-uuid' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when patientId is an empty string', () => {
    const input = createMockZambdaInput({ patientId: '' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should accept second valid UUID for patientId', () => {
    const input = createMockZambdaInput({ patientId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8' }, { secrets });
    const result = validateRequestParameters(input);
    expect(result.patientId).toBe('6ba7b810-9dad-11d1-80b4-00c04fd430c8');
  });
});
