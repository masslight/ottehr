import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/patient/join-call/validateRequestParameters';
import { createMockZambdaInput } from './helpers';

describe('join-call - validateRequestParameters', () => {
  const validBody = {
    appointmentId: '123e4567-e89b-12d3-a456-426614174000',
  };

  test('should return validated params with appointmentId', () => {
    const input = createMockZambdaInput(validBody);
    const result = validateRequestParameters(input);

    expect(result.appointmentId).toBe('123e4567-e89b-12d3-a456-426614174000');
    expect(result.secrets).toBeNull();
  });

  test('should pass secrets through from input', () => {
    const secrets = { PROJECT_API: 'https://api.test' };
    const input = createMockZambdaInput(validBody, { secrets });
    const result = validateRequestParameters(input);
    expect(result.secrets).toEqual(secrets);
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { body: '' });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when body is null', () => {
    const input = createMockZambdaInput(null, { body: null as any });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when appointmentId is missing', () => {
    const input = createMockZambdaInput({});
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when appointmentId is empty string', () => {
    const input = createMockZambdaInput({ appointmentId: '' });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when appointmentId is not a valid UUID', () => {
    const input = createMockZambdaInput({ appointmentId: 'not-a-uuid' });
    expect(() => validateRequestParameters(input)).toThrow();
  });
});
