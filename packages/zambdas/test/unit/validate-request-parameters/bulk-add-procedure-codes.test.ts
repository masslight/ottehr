import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/rcm/fee-schedules/bulk-add-procedure-codes/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

const VALID_FEE_SCHEDULE_ID = '550e8400-e29b-41d4-a716-446655440000';

describe('bulk-add-procedure-codes - validateRequestParameters', () => {
  const secrets = createMockSecrets();

  const validCodes = [
    { code: '99213', amount: 150 },
    { code: '99214', modifier: '25', amount: 200 },
  ];

  test('should return validated params for a valid request', () => {
    const input = createMockZambdaInput(
      { feeScheduleId: VALID_FEE_SCHEDULE_ID, codes: validCodes, replaceAll: true },
      { secrets }
    );
    const result = validateRequestParameters(input);

    expect(result).toEqual({
      feeScheduleId: VALID_FEE_SCHEDULE_ID,
      codes: [
        { code: '99213', modifier: undefined, amount: 150 },
        { code: '99214', modifier: '25', amount: 200 },
      ],
      replaceAll: true,
      secrets,
    });
  });

  test('should default replaceAll to false when not provided', () => {
    const input = createMockZambdaInput({ feeScheduleId: VALID_FEE_SCHEDULE_ID, codes: validCodes }, { secrets });
    const result = validateRequestParameters(input);

    expect(result.replaceAll).toBe(false);
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when feeScheduleId is missing', () => {
    const input = createMockZambdaInput({ codes: validCodes }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when codes is missing', () => {
    const input = createMockZambdaInput({ feeScheduleId: VALID_FEE_SCHEDULE_ID }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when codes is an empty array', () => {
    const input = createMockZambdaInput({ feeScheduleId: VALID_FEE_SCHEDULE_ID, codes: [] }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when feeScheduleId is not a valid UUID', () => {
    const input = createMockZambdaInput({ feeScheduleId: 'not-a-uuid', codes: validCodes }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when a code entry is missing code field', () => {
    const input = createMockZambdaInput(
      { feeScheduleId: VALID_FEE_SCHEDULE_ID, codes: [{ amount: 150 }] },
      { secrets }
    );
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when a code entry is missing amount field', () => {
    const input = createMockZambdaInput(
      { feeScheduleId: VALID_FEE_SCHEDULE_ID, codes: [{ code: '99213' }] },
      { secrets }
    );
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when a code entry has non-number amount', () => {
    const input = createMockZambdaInput(
      { feeScheduleId: VALID_FEE_SCHEDULE_ID, codes: [{ code: '99213', amount: 'one-fifty' }] },
      { secrets }
    );
    expect(() => validateRequestParameters(input)).toThrow();
  });
});
