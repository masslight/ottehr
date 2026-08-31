import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/ehr/init-telemed-session/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('init-telemed-session - validateRequestParameters', () => {
  const secrets = createMockSecrets();

  const validBody = {
    appointmentId: '550e8400-e29b-41d4-a716-446655440000',
    userId: '660e8400-e29b-41d4-a716-446655440001',
  };

  test('should return validated params when all required fields provided', () => {
    const input = createMockZambdaInput(validBody, { secrets });
    const result = validateRequestParameters(input);

    expect(result.appointmentId).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(result.userId).toBe('660e8400-e29b-41d4-a716-446655440001');
    expect(result.secrets).toBe(secrets);
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

  test('should throw when userId is missing', () => {
    const { userId: _, ...rest } = validBody;
    const input = createMockZambdaInput(rest, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when appointmentId is not a valid UUID', () => {
    const input = createMockZambdaInput({ ...validBody, appointmentId: 'not-a-uuid' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when userId is not a valid UUID', () => {
    const input = createMockZambdaInput({ ...validBody, userId: 'not-a-uuid' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when appointmentId is empty string', () => {
    const input = createMockZambdaInput({ ...validBody, appointmentId: '' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when userId is empty string', () => {
    const input = createMockZambdaInput({ ...validBody, userId: '' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });
});
