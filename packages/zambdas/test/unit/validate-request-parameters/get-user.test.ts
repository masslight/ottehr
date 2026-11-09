import { describe, expect, test } from 'vitest';
import { GetUserBodySchema } from '../../../src/ehr/get-user/index';
import { validateWithSchema } from '../../../src/shared/validation';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('get-user - validateRequestParameters', () => {
  const secrets = createMockSecrets();

  test('should return validated params when userId is provided', () => {
    const input = createMockZambdaInput({ userId: '550e8400-e29b-41d4-a716-446655440000' }, { secrets });
    const result = validateWithSchema(GetUserBodySchema, input);

    expect(result.userId).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(result.secrets).toEqual(secrets);
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { body: '', secrets });
    expect(() => validateWithSchema(GetUserBodySchema, input)).toThrow();
  });

  test('should throw when userId is undefined', () => {
    const input = createMockZambdaInput({ someField: 'value' }, { secrets });
    expect(() => validateWithSchema(GetUserBodySchema, input)).toThrow('userId');
  });

  test('should throw when userId is not a valid UUID', () => {
    const input = createMockZambdaInput({ userId: 'user-123' }, { secrets });
    expect(() => validateWithSchema(GetUserBodySchema, input)).toThrow('userId');
  });

  test('should pass secrets through from input', () => {
    const secrets = { PROJECT_API: 'https://api.test' };
    const input = createMockZambdaInput({ userId: '550e8400-e29b-41d4-a716-446655440000' }, { secrets });
    const result = validateWithSchema(GetUserBodySchema, input);
    expect(result.secrets).toEqual(secrets);
  });
});
