import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/rcm/fee-schedules/update-fee-schedule/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('update-fee-schedule - validateRequestParameters', () => {
  const secrets = createMockSecrets();
  const validFeeScheduleId = '550e8400-e29b-41d4-a716-446655440000';

  test('should return validated params for a minimal valid request', () => {
    const input = createMockZambdaInput(
      { feeScheduleId: validFeeScheduleId, name: 'My Fee Schedule', description: 'A description' },
      { secrets }
    );
    const result = validateRequestParameters(input);
    expect(result).toEqual({
      id: validFeeScheduleId,
      name: 'My Fee Schedule',
      effectiveDate: undefined,
      description: 'A description',
      status: undefined,
      designation: undefined,
      caseRateAmount: undefined,
      caseRateComment: undefined,
      secrets,
    });
  });

  test('should return validated params for a full valid request', () => {
    const input = createMockZambdaInput(
      {
        feeScheduleId: validFeeScheduleId,
        name: 'My Fee Schedule',
        description: 'A description',
        effectiveDate: '2024-01-01',
        status: 'active',
        designation: 'case-rate',
        caseRateAmount: 150.0,
        caseRateComment: 'Some comment',
      },
      { secrets }
    );
    const result = validateRequestParameters(input);
    expect(result.id).toBe(validFeeScheduleId);
    expect(result.status).toBe('active');
    expect(result.designation).toBe('case-rate');
    expect(result.caseRateAmount).toBe(150.0);
    expect(result.caseRateComment).toBe('Some comment');
  });

  test('should accept designation as null', () => {
    const input = createMockZambdaInput(
      { feeScheduleId: validFeeScheduleId, name: 'My Fee Schedule', designation: null },
      { secrets }
    );
    const result = validateRequestParameters(input);
    expect(result.designation).toBeNull();
  });

  test('should default description to empty string when not provided', () => {
    const input = createMockZambdaInput({ feeScheduleId: validFeeScheduleId, name: 'My Fee Schedule' }, { secrets });
    const result = validateRequestParameters(input);
    expect(result.description).toBe('');
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when feeScheduleId is missing', () => {
    const input = createMockZambdaInput({ name: 'My Fee Schedule' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when feeScheduleId is not a valid UUID', () => {
    const input = createMockZambdaInput({ feeScheduleId: 'not-a-uuid', name: 'My Fee Schedule' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when name is missing', () => {
    const input = createMockZambdaInput({ feeScheduleId: validFeeScheduleId }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when status is an invalid enum value', () => {
    const input = createMockZambdaInput(
      { feeScheduleId: validFeeScheduleId, name: 'My Fee Schedule', status: 'unknown' },
      { secrets }
    );
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when designation is an invalid value', () => {
    const input = createMockZambdaInput(
      { feeScheduleId: validFeeScheduleId, name: 'My Fee Schedule', designation: 'flat-rate' },
      { secrets }
    );
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when caseRateAmount is negative', () => {
    const input = createMockZambdaInput(
      { feeScheduleId: validFeeScheduleId, name: 'My Fee Schedule', caseRateAmount: -10 },
      { secrets }
    );
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when caseRateAmount is not a number', () => {
    const input = createMockZambdaInput(
      { feeScheduleId: validFeeScheduleId, name: 'My Fee Schedule', caseRateAmount: 'one-hundred' },
      { secrets }
    );
    expect(() => validateRequestParameters(input)).toThrow();
  });
});
