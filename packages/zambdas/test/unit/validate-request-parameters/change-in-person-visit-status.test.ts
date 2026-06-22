import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/ehr/change-in-person-visit-status/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('change-in-person-visit-status - validateRequestParameters', () => {
  const validBody = {
    encounterId: 'enc-123',
    updatedStatus: 'arrived',
  };
  const secrets = createMockSecrets();

  test('should return validated params with valid status', () => {
    const input = createMockZambdaInput(validBody, { secrets });
    const result = validateRequestParameters(input);

    expect(result.encounterId).toBe('enc-123');
    expect(result.updatedStatus).toBe('arrived');
    expect(result.userToken).toBe('test-token');
    expect(result.secrets).toEqual(secrets);
  });

  test.each([
    'pending',
    'arrived',
    'ready',
    'intake',
    'ready for provider',
    'provider',
    'discharged',
    'cancelled',
    'no show',
    'awaiting supervisor approval',
    'completed',
  ])('should accept valid status "%s"', (status) => {
    const input = createMockZambdaInput({ encounterId: 'enc-123', updatedStatus: status }, { secrets });
    expect(() => validateRequestParameters(input)).not.toThrow();
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { body: '', secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when body is not a valid JSON object', () => {
    const input = createMockZambdaInput(null, {
      body: '"just a string"',
      secrets,
      headers: { Authorization: 'Bearer test-token' },
    });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when encounterId is missing', () => {
    const input = createMockZambdaInput({ updatedStatus: 'arrived' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow('encounterId');
  });

  test('should throw when encounterId is not a string', () => {
    const input = createMockZambdaInput({ encounterId: 123, updatedStatus: 'arrived' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow('encounterId');
  });

  test('should throw when updatedStatus is missing', () => {
    const input = createMockZambdaInput({ encounterId: 'enc-123' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow('updatedStatus');
  });

  test('should throw when updatedStatus is not a string', () => {
    const input = createMockZambdaInput({ encounterId: 'enc-123', updatedStatus: 123 }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow('updatedStatus');
  });

  test('should throw when updatedStatus is "unknown"', () => {
    const input = createMockZambdaInput({ encounterId: 'enc-123', updatedStatus: 'unknown' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow('updatedStatus');
  });

  test('should throw when updatedStatus is an invalid value', () => {
    const input = createMockZambdaInput({ encounterId: 'enc-123', updatedStatus: 'invalid-status' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow('updatedStatus');
  });

  test('should throw when secrets are null', () => {
    const input = createMockZambdaInput(validBody, { secrets: null });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when PROJECT_API secret is missing', () => {
    const badSecrets = { ORGANIZATION_ID: 'org-123' };
    const input = createMockZambdaInput(validBody, { secrets: badSecrets });
    expect(() => validateRequestParameters(input)).toThrow('PROJECT_API');
  });

  test('should throw when ORGANIZATION_ID secret is missing', () => {
    const badSecrets = { PROJECT_API: 'https://api.test' };
    const input = createMockZambdaInput(validBody, { secrets: badSecrets });
    expect(() => validateRequestParameters(input)).toThrow('ORGANIZATION_ID');
  });

  test('should extract Bearer token from Authorization header', () => {
    const input = createMockZambdaInput(validBody, {
      secrets,
      headers: { Authorization: 'Bearer my-token-123' },
    });
    const result = validateRequestParameters(input);
    expect(result.userToken).toBe('my-token-123');
  });
});
