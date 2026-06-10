import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/rcm/fee-schedules/update-procedure-code/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('update-procedure-code - validateRequestParameters', () => {
  const secrets = createMockSecrets();
  const validFeeScheduleId = '550e8400-e29b-41d4-a716-446655440000';

  test('should return validated params for a valid request', () => {
    const input = createMockZambdaInput(
      { feeScheduleId: validFeeScheduleId, index: 0, code: '99213', amount: 120.5 },
      { secrets }
    );
    const result = validateRequestParameters(input);
    expect(result).toEqual({
      feeScheduleId: validFeeScheduleId,
      index: 0,
      code: '99213',
      description: undefined,
      modifier: undefined,
      amount: 120.5,
      secrets,
    });
  });

  test('should return validated params with optional fields', () => {
    const input = createMockZambdaInput(
      {
        feeScheduleId: validFeeScheduleId,
        index: 2,
        code: '99214',
        description: 'Office visit',
        modifier: '25',
        amount: 200.0,
      },
      { secrets }
    );
    const result = validateRequestParameters(input);
    expect(result.description).toBe('Office visit');
    expect(result.modifier).toBe('25');
    expect(result.index).toBe(2);
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when feeScheduleId is missing', () => {
    const input = createMockZambdaInput({ index: 0, code: '99213', amount: 100 }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when feeScheduleId is not a valid UUID', () => {
    const input = createMockZambdaInput(
      { feeScheduleId: 'not-a-uuid', index: 0, code: '99213', amount: 100 },
      { secrets }
    );
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when index is missing', () => {
    const input = createMockZambdaInput({ feeScheduleId: validFeeScheduleId, code: '99213', amount: 100 }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when index is negative', () => {
    const input = createMockZambdaInput(
      { feeScheduleId: validFeeScheduleId, index: -1, code: '99213', amount: 100 },
      { secrets }
    );
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when index is not an integer', () => {
    const input = createMockZambdaInput(
      { feeScheduleId: validFeeScheduleId, index: 1.5, code: '99213', amount: 100 },
      { secrets }
    );
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when code is missing', () => {
    const input = createMockZambdaInput({ feeScheduleId: validFeeScheduleId, index: 0, amount: 100 }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when amount is missing', () => {
    const input = createMockZambdaInput({ feeScheduleId: validFeeScheduleId, index: 0, code: '99213' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when amount is not a number', () => {
    const input = createMockZambdaInput(
      { feeScheduleId: validFeeScheduleId, index: 0, code: '99213', amount: 'one-hundred' },
      { secrets }
    );
    expect(() => validateRequestParameters(input)).toThrow();
  });
});
