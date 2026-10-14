import { describe, expect, test } from 'vitest';
import { bodySchema } from '../../../src/patient/join-call/index';
import { validateWithSchema } from '../../../src/shared/validation';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('join-call - validateRequestParameters', () => {
  const secrets = createMockSecrets();

  const validBody = {
    appointmentId: '123e4567-e89b-12d3-a456-426614174000',
  };

  test('should return validated params with appointmentId', () => {
    const input = createMockZambdaInput(validBody, { secrets });
    const result = validateWithSchema(bodySchema, input);

    expect(result.appointmentId).toBe('123e4567-e89b-12d3-a456-426614174000');
    expect(result.secrets).toEqual(secrets);
  });

  test('should pass secrets through from input', () => {
    const secrets = { PROJECT_API: 'https://api.test' };
    const input = createMockZambdaInput(validBody, { secrets });
    const result = validateWithSchema(bodySchema, input);
    expect(result.secrets).toEqual(secrets);
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { body: '', secrets });
    expect(() => validateWithSchema(bodySchema, input)).toThrow();
  });

  test('should throw when body is null', () => {
    const input = createMockZambdaInput(null, { body: null as any, secrets });
    expect(() => validateWithSchema(bodySchema, input)).toThrow();
  });

  test('should throw when appointmentId is missing', () => {
    const input = createMockZambdaInput({}, { secrets });
    expect(() => validateWithSchema(bodySchema, input)).toThrow();
  });

  test('should throw when appointmentId is empty string', () => {
    const input = createMockZambdaInput({ appointmentId: '' }, { secrets });
    expect(() => validateWithSchema(bodySchema, input)).toThrow();
  });

  test('should throw when appointmentId is not a valid UUID', () => {
    const input = createMockZambdaInput({ appointmentId: 'not-a-uuid' }, { secrets });
    expect(() => validateWithSchema(bodySchema, input)).toThrow();
  });
});
