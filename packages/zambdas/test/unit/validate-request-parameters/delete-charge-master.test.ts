import { describe, expect, test } from 'vitest';
import { bodySchema } from '../../../src/rcm/charge-masters/delete-charge-master/index';
import { validateWithSchema } from '../../../src/shared/validation';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('delete-charge-master - validateRequestParameters', () => {
  const secrets = createMockSecrets();

  const validBody = {
    id: '123e4567-e89b-12d3-a456-426614174000',
  };

  test('should return validated params with id', () => {
    const input = createMockZambdaInput(validBody, { secrets });
    const result = validateWithSchema(bodySchema, input);

    expect(result.id).toBe('123e4567-e89b-12d3-a456-426614174000');
    expect(result.secrets).toEqual(secrets);
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { body: '', secrets });
    expect(() => validateWithSchema(bodySchema, input)).toThrow();
  });

  test('should throw when id is missing', () => {
    const input = createMockZambdaInput({}, { secrets });
    expect(() => validateWithSchema(bodySchema, input)).toThrow();
  });

  test('should throw when id is empty string', () => {
    const input = createMockZambdaInput({ id: '' }, { secrets });
    expect(() => validateWithSchema(bodySchema, input)).toThrow();
  });

  test('should throw when id is not a valid UUID', () => {
    const input = createMockZambdaInput({ id: 'not-a-uuid' }, { secrets });
    expect(() => validateWithSchema(bodySchema, input)).toThrow();
  });

  test('should pass secrets through from input', () => {
    const secrets = { PROJECT_API: 'https://api.test' };
    const input = createMockZambdaInput(validBody, { secrets });
    const result = validateWithSchema(bodySchema, input);
    expect(result.secrets).toEqual(secrets);
  });
});
