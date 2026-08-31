import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/rcm/fee-schedules/add-procedure-code/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

const VALID_FEE_SCHEDULE_ID = '550e8400-e29b-41d4-a716-446655440000';

describe('add-procedure-code - validateRequestParameters', () => {
  const secrets = createMockSecrets();

  test('should return validated params for a valid request', () => {
    const input = createMockZambdaInput(
      { feeScheduleId: VALID_FEE_SCHEDULE_ID, code: '99213', description: 'Office Visit', modifier: '25', amount: 150 },
      { secrets }
    );
    const result = validateRequestParameters(input);

    expect(result).toEqual({
      feeScheduleId: VALID_FEE_SCHEDULE_ID,
      code: '99213',
      description: 'Office Visit',
      modifier: '25',
      amount: 150,
      secrets,
    });
  });

  test('should return validated params without optional fields', () => {
    const input = createMockZambdaInput(
      { feeScheduleId: VALID_FEE_SCHEDULE_ID, code: '99213', amount: 150 },
      { secrets }
    );
    const result = validateRequestParameters(input);

    expect(result).toEqual({
      feeScheduleId: VALID_FEE_SCHEDULE_ID,
      code: '99213',
      description: undefined,
      modifier: undefined,
      amount: 150,
      secrets,
    });
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when feeScheduleId is missing', () => {
    const input = createMockZambdaInput({ code: '99213', amount: 150 }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when code is missing', () => {
    const input = createMockZambdaInput({ feeScheduleId: VALID_FEE_SCHEDULE_ID, amount: 150 }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when amount is missing', () => {
    const input = createMockZambdaInput({ feeScheduleId: VALID_FEE_SCHEDULE_ID, code: '99213' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when feeScheduleId is not a valid UUID', () => {
    const input = createMockZambdaInput({ feeScheduleId: 'not-a-uuid', code: '99213', amount: 150 }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when amount is not a number', () => {
    const input = createMockZambdaInput(
      { feeScheduleId: VALID_FEE_SCHEDULE_ID, code: '99213', amount: 'one-fifty' },
      { secrets }
    );
    expect(() => validateRequestParameters(input)).toThrow();
  });
});
