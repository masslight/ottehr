import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/rcm/charge-masters/get-charge-master-entry/validateRequestParameters';
import { createMockZambdaInput } from './helpers';

describe('get-charge-master-entry - validateRequestParameters', () => {
  const validBody = {
    designation: 'default-insurance' as const,
  };

  test('should return validated params with designation only', () => {
    const input = createMockZambdaInput(validBody);
    const result = validateRequestParameters(input);

    expect(result.designation).toBe('default-insurance');
    expect(result.payerOrganizationId).toBeUndefined();
    expect(result.locationId).toBeUndefined();
    expect(result.employerOrganizationId).toBeUndefined();
    expect(result.dateOfService).toBeUndefined();
    expect(result.secrets).toBeNull();
  });

  test('should accept self-pay designation', () => {
    const input = createMockZambdaInput({ designation: 'self-pay' });
    const result = validateRequestParameters(input);
    expect(result.designation).toBe('self-pay');
  });

  test('should accept optional payerOrganizationId (alphanumeric)', () => {
    const input = createMockZambdaInput({
      ...validBody,
      payerOrganizationId: 'payer-org-123',
    });
    const result = validateRequestParameters(input);
    expect(result.payerOrganizationId).toBe('payer-org-123');
  });

  test('should accept optional locationId (UUID)', () => {
    const input = createMockZambdaInput({
      ...validBody,
      locationId: '123e4567-e89b-12d3-a456-426614174000',
    });
    const result = validateRequestParameters(input);
    expect(result.locationId).toBe('123e4567-e89b-12d3-a456-426614174000');
  });

  test('should accept optional employerOrganizationId (UUID)', () => {
    const input = createMockZambdaInput({
      ...validBody,
      employerOrganizationId: '123e4567-e89b-12d3-a456-426614174000',
    });
    const result = validateRequestParameters(input);
    expect(result.employerOrganizationId).toBe('123e4567-e89b-12d3-a456-426614174000');
  });

  test('should accept optional dateOfService', () => {
    const input = createMockZambdaInput({
      ...validBody,
      dateOfService: '2024-06-01',
    });
    const result = validateRequestParameters(input);
    expect(result.dateOfService).toBe('2024-06-01');
  });

  test('should convert falsy optional fields to undefined', () => {
    const input = createMockZambdaInput({
      ...validBody,
      payerOrganizationId: '',
      locationId: '',
      employerOrganizationId: '',
      dateOfService: '',
    });
    const result = validateRequestParameters(input);
    expect(result.payerOrganizationId).toBeUndefined();
    expect(result.locationId).toBeUndefined();
    expect(result.employerOrganizationId).toBeUndefined();
    expect(result.dateOfService).toBeUndefined();
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { body: '' });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when designation is missing', () => {
    const input = createMockZambdaInput({});
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when designation is invalid', () => {
    const input = createMockZambdaInput({ designation: 'invalid' });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when payerOrganizationId is invalid', () => {
    const input = createMockZambdaInput({
      ...validBody,
      payerOrganizationId: '!!!invalid!!!',
    });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when locationId is not a valid UUID', () => {
    const input = createMockZambdaInput({
      ...validBody,
      locationId: 'not-a-uuid',
    });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when employerOrganizationId is not a valid UUID', () => {
    const input = createMockZambdaInput({
      ...validBody,
      employerOrganizationId: 'not-a-uuid',
    });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when dateOfService is not a valid date string', () => {
    const input = createMockZambdaInput({
      ...validBody,
      dateOfService: 'not-a-date',
    });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when dateOfService is in wrong format', () => {
    const input = createMockZambdaInput({
      ...validBody,
      dateOfService: '06/01/2024',
    });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should pass secrets through from input', () => {
    const secrets = { PROJECT_API: 'https://api.test' };
    const input = createMockZambdaInput(validBody, { secrets });
    const result = validateRequestParameters(input);
    expect(result.secrets).toEqual(secrets);
  });
});
