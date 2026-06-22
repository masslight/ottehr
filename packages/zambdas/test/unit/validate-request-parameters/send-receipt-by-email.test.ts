import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/ehr/send-receipt-by-email/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('send-receipt-by-email - validateRequestParameters', () => {
  const secrets = createMockSecrets();
  const validUUID = '550e8400-e29b-41d4-a716-446655440000';

  const validBody = {
    recipientFullName: 'John Doe',
    email: 'john@example.com',
    receiptDocRefId: validUUID,
  };

  test('should return validated params for a valid request', () => {
    const input = createMockZambdaInput(validBody, { secrets });
    const result = validateRequestParameters(input);

    expect(result).toEqual({
      recipientFullName: 'John Doe',
      email: 'john@example.com',
      receiptDocRefId: validUUID,
      secrets,
    });
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when recipientFullName is missing', () => {
    const input = createMockZambdaInput({ email: 'john@example.com', receiptDocRefId: validUUID }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when email is missing', () => {
    const input = createMockZambdaInput({ recipientFullName: 'John Doe', receiptDocRefId: validUUID }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when receiptDocRefId is missing', () => {
    const input = createMockZambdaInput({ recipientFullName: 'John Doe', email: 'john@example.com' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when receiptDocRefId is not a valid UUID', () => {
    const input = createMockZambdaInput(
      { recipientFullName: 'John Doe', email: 'john@example.com', receiptDocRefId: 'not-uuid' },
      { secrets }
    );
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should strip extra fields', () => {
    const input = createMockZambdaInput({ ...validBody, extra: 'field' }, { secrets });
    const result = validateRequestParameters(input);

    expect((result as any).extra).toBeUndefined();
  });
});
