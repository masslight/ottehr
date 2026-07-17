import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/rcm/fee-schedules/find-applicable-fee-schedule/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('find-applicable-fee-schedule - validateRequestParameters', () => {
  const secrets = createMockSecrets();
  const validLocationId = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
  const validEmployerOrgId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

  test('should return validated params with payerOrganizationId', () => {
    const input = createMockZambdaInput({ payerOrganizationId: 'payer-abc', dateOfService: '2024-01-15' }, { secrets });
    const result = validateRequestParameters(input);
    expect(result).toEqual({
      payerOrganizationId: 'payer-abc',
      dateOfService: '2024-01-15',
      locationId: undefined,
      employerOrganizationId: undefined,
      secrets,
    });
  });

  test('should return validated params with employerOrganizationId', () => {
    const input = createMockZambdaInput(
      { employerOrganizationId: validEmployerOrgId, dateOfService: '2024-01-15' },
      { secrets }
    );
    const result = validateRequestParameters(input);
    expect(result.employerOrganizationId).toBe(validEmployerOrgId);
    expect(result.dateOfService).toBe('2024-01-15');
  });

  test('should return validated params with all optional fields', () => {
    const input = createMockZambdaInput(
      {
        payerOrganizationId: 'payer-abc',
        dateOfService: '2024-01-15',
        locationId: validLocationId,
        employerOrganizationId: validEmployerOrgId,
      },
      { secrets }
    );
    const result = validateRequestParameters(input);
    expect(result.payerOrganizationId).toBe('payer-abc');
    expect(result.locationId).toBe(validLocationId);
    expect(result.employerOrganizationId).toBe(validEmployerOrgId);
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when neither payerOrganizationId nor employerOrganizationId is provided', () => {
    const input = createMockZambdaInput({ dateOfService: '2024-01-15' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when dateOfService is missing', () => {
    const input = createMockZambdaInput({ payerOrganizationId: 'payer-abc' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when dateOfService is not a valid YYYY-MM-DD format', () => {
    const input = createMockZambdaInput({ payerOrganizationId: 'payer-abc', dateOfService: '01/15/2024' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when locationId is not a valid UUID', () => {
    const input = createMockZambdaInput(
      { payerOrganizationId: 'payer-abc', dateOfService: '2024-01-15', locationId: 'not-a-uuid' },
      { secrets }
    );
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when employerOrganizationId is not a valid UUID', () => {
    const input = createMockZambdaInput(
      { employerOrganizationId: 'not-a-uuid', dateOfService: '2024-01-15' },
      { secrets }
    );
    expect(() => validateRequestParameters(input)).toThrow();
  });
});
