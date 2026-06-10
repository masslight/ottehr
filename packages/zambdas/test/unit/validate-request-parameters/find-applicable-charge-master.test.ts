import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/rcm/charge-masters/find-applicable-charge-master/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('find-applicable-charge-master - validateRequestParameters', () => {
  const secrets = createMockSecrets();
  const validLocationId = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
  const validEmployerOrganizationId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

  test('should return validated params for a valid request with only dateOfService', () => {
    const input = createMockZambdaInput({ dateOfService: '2024-01-15' }, { secrets });
    const result = validateRequestParameters(input);
    expect(result).toEqual({
      payerOrganizationId: undefined,
      dateOfService: '2024-01-15',
      locationId: undefined,
      employerOrganizationId: undefined,
      secrets,
    });
  });

  test('should return validated params with all optional fields', () => {
    const input = createMockZambdaInput(
      {
        payerOrganizationId: 'payer-abc-123',
        dateOfService: '2024-06-01',
        locationId: validLocationId,
        employerOrganizationId: validEmployerOrganizationId,
      },
      { secrets }
    );
    const result = validateRequestParameters(input);
    expect(result).toEqual({
      payerOrganizationId: 'payer-abc-123',
      dateOfService: '2024-06-01',
      locationId: validLocationId,
      employerOrganizationId: validEmployerOrganizationId,
      secrets,
    });
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when dateOfService is missing', () => {
    const input = createMockZambdaInput({ payerOrganizationId: 'payer-abc-123' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when dateOfService has invalid format', () => {
    const input = createMockZambdaInput({ dateOfService: '01-15-2024' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when locationId is not a valid UUID', () => {
    const input = createMockZambdaInput({ dateOfService: '2024-01-15', locationId: 'not-a-uuid' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when employerOrganizationId is not a valid UUID', () => {
    const input = createMockZambdaInput(
      { dateOfService: '2024-01-15', employerOrganizationId: 'not-a-uuid' },
      { secrets }
    );
    expect(() => validateRequestParameters(input)).toThrow();
  });
});
