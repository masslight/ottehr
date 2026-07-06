import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/rcm/fee-schedules/associate-payer/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

const VALID_FEE_SCHEDULE_ID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_LOCATION_ID = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

describe('associate-payer - validateRequestParameters', () => {
  const secrets = createMockSecrets();

  test('should return validated params with organizationId', () => {
    const input = createMockZambdaInput(
      { feeScheduleId: VALID_FEE_SCHEDULE_ID, organizationId: 'payer-org-123' },
      { secrets }
    );
    const result = validateRequestParameters(input);

    expect(result).toEqual({
      feeScheduleId: VALID_FEE_SCHEDULE_ID,
      organizationId: 'payer-org-123',
      locationId: undefined,
      secrets,
    });
  });

  test('should return validated params with locationId (UUID)', () => {
    const input = createMockZambdaInput(
      { feeScheduleId: VALID_FEE_SCHEDULE_ID, locationId: VALID_LOCATION_ID },
      { secrets }
    );
    const result = validateRequestParameters(input);

    expect(result).toEqual({
      feeScheduleId: VALID_FEE_SCHEDULE_ID,
      organizationId: undefined,
      locationId: VALID_LOCATION_ID,
      secrets,
    });
  });

  test('should return validated params with both organizationId and locationId', () => {
    const input = createMockZambdaInput(
      { feeScheduleId: VALID_FEE_SCHEDULE_ID, organizationId: 'payer-org-123', locationId: VALID_LOCATION_ID },
      { secrets }
    );
    const result = validateRequestParameters(input);

    expect(result).toEqual({
      feeScheduleId: VALID_FEE_SCHEDULE_ID,
      organizationId: 'payer-org-123',
      locationId: VALID_LOCATION_ID,
      secrets,
    });
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when feeScheduleId is missing', () => {
    const input = createMockZambdaInput({ organizationId: 'payer-org-123' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when both organizationId and locationId are missing', () => {
    const input = createMockZambdaInput({ feeScheduleId: VALID_FEE_SCHEDULE_ID }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when feeScheduleId is not a valid UUID', () => {
    const input = createMockZambdaInput({ feeScheduleId: 'not-a-uuid', organizationId: 'payer-org-123' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when locationId is not a valid UUID', () => {
    const input = createMockZambdaInput(
      { feeScheduleId: VALID_FEE_SCHEDULE_ID, locationId: 'not-a-uuid' },
      { secrets }
    );
    expect(() => validateRequestParameters(input)).toThrow();
  });
});
