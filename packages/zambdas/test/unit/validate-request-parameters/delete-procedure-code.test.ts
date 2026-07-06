import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/rcm/fee-schedules/delete-procedure-code/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

const VALID_FEE_SCHEDULE_ID = '550e8400-e29b-41d4-a716-446655440000';

describe('delete-procedure-code - validateRequestParameters', () => {
  const secrets = createMockSecrets();

  test('should return validated params for a valid request', () => {
    const input = createMockZambdaInput({ feeScheduleId: VALID_FEE_SCHEDULE_ID, index: 0 }, { secrets });
    const result = validateRequestParameters(input);

    expect(result).toEqual({
      feeScheduleId: VALID_FEE_SCHEDULE_ID,
      index: 0,
      secrets,
    });
  });

  test('should return validated params with a positive index', () => {
    const input = createMockZambdaInput({ feeScheduleId: VALID_FEE_SCHEDULE_ID, index: 5 }, { secrets });
    const result = validateRequestParameters(input);

    expect(result.index).toBe(5);
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when feeScheduleId is missing', () => {
    const input = createMockZambdaInput({ index: 0 }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when index is missing', () => {
    const input = createMockZambdaInput({ feeScheduleId: VALID_FEE_SCHEDULE_ID }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when feeScheduleId is not a valid UUID', () => {
    const input = createMockZambdaInput({ feeScheduleId: 'not-a-uuid', index: 0 }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when index is negative', () => {
    const input = createMockZambdaInput({ feeScheduleId: VALID_FEE_SCHEDULE_ID, index: -1 }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when index is not a number', () => {
    const input = createMockZambdaInput({ feeScheduleId: VALID_FEE_SCHEDULE_ID, index: 'zero' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when index is a float', () => {
    const input = createMockZambdaInput({ feeScheduleId: VALID_FEE_SCHEDULE_ID, index: 1.5 }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });
});
