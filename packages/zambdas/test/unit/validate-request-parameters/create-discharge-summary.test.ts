import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/ehr/create-discharge-summary/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('create-discharge-summary - validateRequestParameters', () => {
  const validUUID = '550e8400-e29b-41d4-a716-446655440000';
  const secrets = createMockSecrets();

  test('should return validated params for a valid request', () => {
    const input = createMockZambdaInput({ appointmentId: validUUID }, { secrets });
    const result = validateRequestParameters(input);

    expect(result).toEqual({
      appointmentId: validUUID,
      secrets,
      userToken: 'test-token',
    });
  });

  test('should accept optional timezone', () => {
    const input = createMockZambdaInput({ appointmentId: validUUID, timezone: 'America/New_York' }, { secrets });
    const result = validateRequestParameters(input);

    expect(result).toEqual({
      appointmentId: validUUID,
      timezone: 'America/New_York',
      secrets,
      userToken: 'test-token',
    });
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when Authorization header is missing', () => {
    const input = createMockZambdaInput({ appointmentId: validUUID }, { secrets, headers: {} as any });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when appointmentId is missing', () => {
    const input = createMockZambdaInput({}, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when appointmentId is not a valid UUID', () => {
    const input = createMockZambdaInput({ appointmentId: 'not-a-uuid' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should extract bearer token from Authorization header', () => {
    const input = createMockZambdaInput(
      { appointmentId: validUUID },
      {
        secrets,
        headers: { Authorization: 'Bearer my-special-token' },
      }
    );
    const result = validateRequestParameters(input);

    expect(result.userToken).toBe('my-special-token');
  });
});
