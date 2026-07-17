import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/rcm/charge-masters/cm-update-procedure-code/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('cm-update-procedure-code - validateRequestParameters', () => {
  const secrets = createMockSecrets();
  const validChargeMasterId = '550e8400-e29b-41d4-a716-446655440000';

  test('should return validated params for a valid request', () => {
    const input = createMockZambdaInput(
      { chargeMasterId: validChargeMasterId, index: 0, code: '99213', amount: 150 },
      { secrets }
    );
    const result = validateRequestParameters(input);
    expect(result).toEqual({
      chargeMasterId: validChargeMasterId,
      index: 0,
      code: '99213',
      description: undefined,
      modifier: undefined,
      amount: 150,
      secrets,
    });
  });

  test('should return validated params with optional fields', () => {
    const input = createMockZambdaInput(
      {
        chargeMasterId: validChargeMasterId,
        index: 2,
        code: '99213',
        description: 'Office visit',
        modifier: '25',
        amount: 200,
      },
      { secrets }
    );
    const result = validateRequestParameters(input);
    expect(result).toEqual({
      chargeMasterId: validChargeMasterId,
      index: 2,
      code: '99213',
      description: 'Office visit',
      modifier: '25',
      amount: 200,
      secrets,
    });
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when chargeMasterId is missing', () => {
    const input = createMockZambdaInput({ index: 0, code: '99213', amount: 150 }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when chargeMasterId is not a valid UUID', () => {
    const input = createMockZambdaInput(
      { chargeMasterId: 'not-a-uuid', index: 0, code: '99213', amount: 150 },
      { secrets }
    );
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when index is missing', () => {
    const input = createMockZambdaInput(
      { chargeMasterId: validChargeMasterId, code: '99213', amount: 150 },
      { secrets }
    );
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when index is negative', () => {
    const input = createMockZambdaInput(
      { chargeMasterId: validChargeMasterId, index: -1, code: '99213', amount: 150 },
      { secrets }
    );
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when code is missing', () => {
    const input = createMockZambdaInput({ chargeMasterId: validChargeMasterId, index: 0, amount: 150 }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when amount is missing', () => {
    const input = createMockZambdaInput({ chargeMasterId: validChargeMasterId, index: 0, code: '99213' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when amount is not a number', () => {
    const input = createMockZambdaInput(
      { chargeMasterId: validChargeMasterId, index: 0, code: '99213', amount: 'notanumber' },
      { secrets }
    );
    expect(() => validateRequestParameters(input)).toThrow();
  });
});
