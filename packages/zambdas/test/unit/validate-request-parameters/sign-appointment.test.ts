import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/ehr/sign-appointment/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('sign-appointment - validateRequestParameters', () => {
  const secrets = createMockSecrets();

  const validBody = {
    appointmentId: '550e8400-e29b-41d4-a716-446655440000',
    encounterId: '660e8400-e29b-41d4-a716-446655440001',
  };

  test('should return validated params when all required fields provided', () => {
    const input = createMockZambdaInput(validBody, { secrets });
    const result = validateRequestParameters(input);

    expect(result.appointmentId).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(result.encounterId).toBe('660e8400-e29b-41d4-a716-446655440001');
    expect(result.secrets).toBe(secrets);
    expect(result.userToken).toBe('test-token');
    expect(result.timezone).toBeNull();
    expect(result.supervisorApprovalEnabled).toBe(false);
  });

  test('should accept optional timezone', () => {
    const input = createMockZambdaInput({ ...validBody, timezone: 'America/New_York' }, { secrets });
    const result = validateRequestParameters(input);

    expect(result.timezone).toBe('America/New_York');
  });

  test('should accept supervisorApprovalEnabled', () => {
    const input = createMockZambdaInput({ ...validBody, supervisorApprovalEnabled: true }, { secrets });
    const result = validateRequestParameters(input);

    expect(result.supervisorApprovalEnabled).toBe(true);
  });

  test('should throw when supervisorApprovalEnabled is not a boolean', () => {
    const input = createMockZambdaInput({ ...validBody, supervisorApprovalEnabled: 'yes' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { body: '', secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when appointmentId is missing', () => {
    const { appointmentId: _, ...rest } = validBody;
    const input = createMockZambdaInput(rest, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when appointmentId is not a string', () => {
    const input = createMockZambdaInput({ ...validBody, appointmentId: 123 }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when appointmentId is not a valid UUID', () => {
    const input = createMockZambdaInput({ ...validBody, appointmentId: 'not-a-uuid' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when encounterId is missing', () => {
    const { encounterId: _, ...rest } = validBody;
    const input = createMockZambdaInput(rest, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when encounterId is not a string', () => {
    const input = createMockZambdaInput({ ...validBody, encounterId: 123 }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when encounterId is not a valid UUID', () => {
    const input = createMockZambdaInput({ ...validBody, encounterId: 'not-a-uuid' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when timezone is not a string', () => {
    const input = createMockZambdaInput({ ...validBody, timezone: 123 }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when secrets is null', () => {
    const input = createMockZambdaInput(validBody, { secrets: null });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should accept null timezone', () => {
    const input = createMockZambdaInput({ ...validBody, timezone: null }, { secrets });
    const result = validateRequestParameters(input);
    expect(result.timezone).toBeNull();
  });
});
