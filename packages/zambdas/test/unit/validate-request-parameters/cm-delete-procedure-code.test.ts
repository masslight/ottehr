import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/rcm/charge-masters/cm-delete-procedure-code/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('cm-delete-procedure-code - validateRequestParameters', () => {
  const secrets = createMockSecrets();
  const validChargeMasterId = '550e8400-e29b-41d4-a716-446655440000';

  test('should return validated params for a valid request', () => {
    const input = createMockZambdaInput({ chargeMasterId: validChargeMasterId, index: 0 }, { secrets });
    const result = validateRequestParameters(input);
    expect(result).toEqual({
      chargeMasterId: validChargeMasterId,
      index: 0,
      secrets,
    });
  });

  test('should allow positive index values', () => {
    const input = createMockZambdaInput({ chargeMasterId: validChargeMasterId, index: 5 }, { secrets });
    const result = validateRequestParameters(input);
    expect(result.index).toBe(5);
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when chargeMasterId is missing', () => {
    const input = createMockZambdaInput({ index: 0 }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when chargeMasterId is not a valid UUID', () => {
    const input = createMockZambdaInput({ chargeMasterId: 'not-a-uuid', index: 0 }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when index is missing', () => {
    const input = createMockZambdaInput({ chargeMasterId: validChargeMasterId }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when index is negative', () => {
    const input = createMockZambdaInput({ chargeMasterId: validChargeMasterId, index: -1 }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when index is not a number', () => {
    const input = createMockZambdaInput({ chargeMasterId: validChargeMasterId, index: 'abc' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });
});
