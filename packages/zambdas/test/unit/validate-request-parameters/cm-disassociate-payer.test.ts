import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/rcm/charge-masters/cm-disassociate-payer/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('cm-disassociate-payer - validateRequestParameters', () => {
  const secrets = createMockSecrets();
  const validChargeMasterId = '550e8400-e29b-41d4-a716-446655440000';
  const validLocationId = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

  test('should return validated params with organizationId', () => {
    const input = createMockZambdaInput(
      { chargeMasterId: validChargeMasterId, organizationId: 'payer-abc-123' },
      { secrets }
    );
    const result = validateRequestParameters(input);
    expect(result).toEqual({
      chargeMasterId: validChargeMasterId,
      organizationId: 'payer-abc-123',
      locationId: undefined,
      secrets,
    });
  });

  test('should return validated params with locationId', () => {
    const input = createMockZambdaInput(
      { chargeMasterId: validChargeMasterId, locationId: validLocationId },
      { secrets }
    );
    const result = validateRequestParameters(input);
    expect(result).toEqual({
      chargeMasterId: validChargeMasterId,
      organizationId: undefined,
      locationId: validLocationId,
      secrets,
    });
  });

  test('should return validated params with both organizationId and locationId', () => {
    const input = createMockZambdaInput(
      { chargeMasterId: validChargeMasterId, organizationId: 'payer-abc-123', locationId: validLocationId },
      { secrets }
    );
    const result = validateRequestParameters(input);
    expect(result).toEqual({
      chargeMasterId: validChargeMasterId,
      organizationId: 'payer-abc-123',
      locationId: validLocationId,
      secrets,
    });
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when chargeMasterId is missing', () => {
    const input = createMockZambdaInput({ organizationId: 'payer-abc-123' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when chargeMasterId is not a valid UUID', () => {
    const input = createMockZambdaInput({ chargeMasterId: 'not-a-uuid', organizationId: 'payer-abc-123' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when locationId is not a valid UUID', () => {
    const input = createMockZambdaInput({ chargeMasterId: validChargeMasterId, locationId: 'not-a-uuid' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when neither organizationId nor locationId is provided', () => {
    const input = createMockZambdaInput({ chargeMasterId: validChargeMasterId }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });
});
