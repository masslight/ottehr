import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/rcm/fee-schedules/disassociate-payer/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('disassociate-payer - validateRequestParameters', () => {
  const secrets = createMockSecrets();
  const validFeeScheduleId = '550e8400-e29b-41d4-a716-446655440000';
  const validLocationId = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

  test('should return validated params with organizationId', () => {
    const input = createMockZambdaInput(
      { feeScheduleId: validFeeScheduleId, organizationId: 'payer-org-123' },
      { secrets }
    );
    const result = validateRequestParameters(input);
    expect(result).toEqual({
      feeScheduleId: validFeeScheduleId,
      organizationId: 'payer-org-123',
      locationId: undefined,
      secrets,
    });
  });

  test('should return validated params with locationId', () => {
    const input = createMockZambdaInput(
      { feeScheduleId: validFeeScheduleId, locationId: validLocationId },
      { secrets }
    );
    const result = validateRequestParameters(input);
    expect(result).toEqual({
      feeScheduleId: validFeeScheduleId,
      organizationId: undefined,
      locationId: validLocationId,
      secrets,
    });
  });

  test('should return validated params with both organizationId and locationId', () => {
    const input = createMockZambdaInput(
      { feeScheduleId: validFeeScheduleId, organizationId: 'payer-org-123', locationId: validLocationId },
      { secrets }
    );
    const result = validateRequestParameters(input);
    expect(result.feeScheduleId).toBe(validFeeScheduleId);
    expect(result.organizationId).toBe('payer-org-123');
    expect(result.locationId).toBe(validLocationId);
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when feeScheduleId is missing', () => {
    const input = createMockZambdaInput({ organizationId: 'payer-org-123' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when feeScheduleId is not a valid UUID', () => {
    const input = createMockZambdaInput({ feeScheduleId: 'not-a-uuid', organizationId: 'payer-org-123' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when locationId is not a valid UUID', () => {
    const input = createMockZambdaInput({ feeScheduleId: validFeeScheduleId, locationId: 'not-a-uuid' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when neither organizationId nor locationId is provided', () => {
    const input = createMockZambdaInput({ feeScheduleId: validFeeScheduleId }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });
});
