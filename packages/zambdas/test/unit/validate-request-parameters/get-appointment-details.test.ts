import { describe, expect, test } from 'vitest';
import { bodySchema } from '../../../src/patient/get-appointment-details/index';
import { validateWithSchema } from '../../../src/shared/validation';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('get-appointment-details - validateRequestParameters', () => {
  const secrets = createMockSecrets();

  const validBody = {
    appointmentID: '123e4567-e89b-12d3-a456-426614174000',
  };

  test('should return validated params with appointmentID', () => {
    const input = createMockZambdaInput(validBody, { secrets });
    const result = validateWithSchema(bodySchema, input);

    expect(result.appointmentID).toBe('123e4567-e89b-12d3-a456-426614174000');
    expect(result.secrets).toEqual(secrets);
  });

  test('should pass secrets through from input', () => {
    const secrets = { PROJECT_API: 'https://api.test' };
    const input = createMockZambdaInput(validBody, { secrets });
    const result = validateWithSchema(bodySchema, input);
    expect(result.secrets).toEqual(secrets);
  });

  test('should throw when body is empty string', () => {
    const input = createMockZambdaInput(null, { body: '', secrets });
    expect(() => validateWithSchema(bodySchema, input)).toThrow();
  });

  test('should throw when body is null', () => {
    const input = createMockZambdaInput(null, { body: null as any, secrets });
    expect(() => validateWithSchema(bodySchema, input)).toThrow();
  });

  test('should throw when appointmentID is not a valid UUID', () => {
    const input = createMockZambdaInput({ appointmentID: 'not-a-uuid' }, { secrets });
    expect(() => validateWithSchema(bodySchema, input)).toThrow();
  });

  test('should throw when appointmentID is empty string', () => {
    const input = createMockZambdaInput({ appointmentID: '' }, { secrets });
    expect(() => validateWithSchema(bodySchema, input)).toThrow();
  });

  test('should throw when appointmentID is missing', () => {
    const input = createMockZambdaInput({}, { secrets });
    expect(() => validateWithSchema(bodySchema, input)).toThrow();
  });
});
