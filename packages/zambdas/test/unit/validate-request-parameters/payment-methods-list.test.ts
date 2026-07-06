import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/patient/payment-methods/list/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('payment-methods-list - validateRequestParameters', () => {
  const secrets = createMockSecrets();
  const validUuid1 = '550e8400-e29b-41d4-a716-446655440000';
  const validUuid2 = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

  const validBody = {
    beneficiaryPatientId: validUuid1,
    appointmentId: validUuid2,
  };

  test('should return validated params for a valid request', () => {
    const input = createMockZambdaInput(validBody, { secrets });
    const result = validateRequestParameters(input);

    expect(result).toMatchObject({
      beneficiaryPatientId: validUuid1,
      appointmentId: validUuid2,
      secrets,
    });
    expect(result.authorization).toBe('Bearer test-token');
  });

  test('should throw when Authorization header is missing', () => {
    const input = createMockZambdaInput(validBody, { secrets, headers: {} as any });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when beneficiaryPatientId is missing', () => {
    const { beneficiaryPatientId: _omit, ...rest } = validBody;
    const input = createMockZambdaInput(rest, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when beneficiaryPatientId is not a valid UUID', () => {
    const input = createMockZambdaInput({ ...validBody, beneficiaryPatientId: 'not-a-uuid' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when appointmentId is missing', () => {
    const { appointmentId: _omit, ...rest } = validBody;
    const input = createMockZambdaInput(rest, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when appointmentId is not a valid UUID', () => {
    const input = createMockZambdaInput({ ...validBody, appointmentId: 'not-a-uuid' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });
});
