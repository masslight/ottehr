import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/ehr/unlock-appointment/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('unlock-appointment - validateRequestParameters', () => {
  const secrets = createMockSecrets();

  test('should return validated params with valid input', () => {
    const input = createMockZambdaInput({ appointmentId: '550e8400-e29b-41d4-a716-446655440000' }, { secrets });
    const result = validateRequestParameters(input);

    expect(result.appointmentId).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(result.userToken).toBe('test-token');
    expect(result.secrets).toEqual(secrets);
  });

  test('should return validated params with valid encounterId (annotation follow-up)', () => {
    const input = createMockZambdaInput({ encounterId: '550e8400-e29b-41d4-a716-446655440000' }, { secrets });
    const result = validateRequestParameters(input);

    expect(result.encounterId).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(result.appointmentId).toBeUndefined();
    expect(result.userToken).toBe('test-token');
    expect(result.secrets).toEqual(secrets);
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { body: '', secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when neither appointmentId nor encounterId is provided', () => {
    const input = createMockZambdaInput({ someField: 'value' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow('appointmentId');
  });

  test('should throw when PROJECT_API secret is missing', () => {
    const badSecrets = { ORGANIZATION_ID: 'org-123' };
    const input = createMockZambdaInput(
      { appointmentId: '550e8400-e29b-41d4-a716-446655440000' },
      { secrets: badSecrets }
    );
    expect(() => validateRequestParameters(input)).toThrow('PROJECT_API');
  });

  test('should throw when ORGANIZATION_ID secret is missing', () => {
    const badSecrets = { PROJECT_API: 'https://api.test' };
    const input = createMockZambdaInput(
      { appointmentId: '550e8400-e29b-41d4-a716-446655440000' },
      { secrets: badSecrets }
    );
    expect(() => validateRequestParameters(input)).toThrow('ORGANIZATION_ID');
  });

  test('should throw when appointmentId is not a valid UUID', () => {
    const input = createMockZambdaInput({ appointmentId: 'appt-123' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow('appointmentId');
  });

  test('should throw when secrets are null', () => {
    const input = createMockZambdaInput({ appointmentId: '550e8400-e29b-41d4-a716-446655440000' }, { secrets: null });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should extract Bearer token from Authorization header', () => {
    const input = createMockZambdaInput(
      { appointmentId: '550e8400-e29b-41d4-a716-446655440000' },
      {
        secrets,
        headers: { Authorization: 'Bearer custom-token' },
      }
    );
    const result = validateRequestParameters(input);
    expect(result.userToken).toBe('custom-token');
  });
});
