import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/patient/payment-methods/delete/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('payment-methods-delete - validateRequestParameters', () => {
  const secrets = createMockSecrets();
  const validUuid1 = '550e8400-e29b-41d4-a716-446655440000';

  const validBody = {
    beneficiaryPatientId: 'not-a-uuid-but-ok',
    paymentMethodId: 'pm_abc123stripe',
    appointmentId: validUuid1,
  };

  test('should return validated params for a valid request', () => {
    const input = createMockZambdaInput(validBody, { secrets });
    const result = validateRequestParameters(input);

    expect(result).toEqual({
      beneficiaryPatientId: validBody.beneficiaryPatientId,
      paymentMethodId: validBody.paymentMethodId,
      appointmentId: validUuid1,
      secrets,
    });
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

  test('should throw when paymentMethodId is missing', () => {
    const { paymentMethodId: _omit, ...rest } = validBody;
    const input = createMockZambdaInput(rest, { secrets });
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
