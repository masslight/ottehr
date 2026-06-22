import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/ehr/bulk-update-insurance-status/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('bulk-update-insurance-status - validateRequestParameters', () => {
  const secrets = createMockSecrets();

  const UUID_1 = '550e8400-e29b-41d4-a716-446655440000';
  const UUID_2 = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

  test('should return validated params for a valid request', () => {
    const input = createMockZambdaInput({ insuranceIds: [UUID_1, UUID_2], active: true }, { secrets });
    const result = validateRequestParameters(input);

    expect(result).toEqual({
      insuranceIds: [UUID_1, UUID_2],
      active: true,
      secrets,
    });
  });

  test('should accept active as false', () => {
    const input = createMockZambdaInput({ insuranceIds: [UUID_1], active: false }, { secrets });
    const result = validateRequestParameters(input);

    expect(result.active).toBe(false);
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when insuranceIds is missing', () => {
    const input = createMockZambdaInput({ active: true }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when active is missing', () => {
    const input = createMockZambdaInput({ insuranceIds: [UUID_1] }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when insuranceIds is not an array', () => {
    const input = createMockZambdaInput({ insuranceIds: UUID_1, active: true }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when insuranceIds is empty', () => {
    const input = createMockZambdaInput({ insuranceIds: [], active: true }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when insuranceIds contains non-strings', () => {
    const input = createMockZambdaInput({ insuranceIds: [123, 456], active: true }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when insuranceIds contains non-UUID strings', () => {
    const input = createMockZambdaInput({ insuranceIds: ['ins-1', 'ins-2'], active: true }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when active is not a boolean', () => {
    const input = createMockZambdaInput({ insuranceIds: [UUID_1], active: 'true' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when secrets are missing', () => {
    const input = createMockZambdaInput({ insuranceIds: [UUID_1], active: true });
    expect(() => validateRequestParameters(input)).toThrow();
  });
});
