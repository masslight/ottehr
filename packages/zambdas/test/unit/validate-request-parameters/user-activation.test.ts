import { UserActivationZambdaInputSchema } from 'utils/lib/types/api/user-activation.types';
import { describe, expect, test } from 'vitest';
import { validateWithSchema } from '../../../src/shared/validation';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('user-activation - validateRequestParameters', () => {
  const secrets = createMockSecrets();

  const validBody = {
    userId: '550e8400-e29b-41d4-a716-446655440000',
    userActivationMode: 'activate',
  };

  test('should return validated params for activate mode', () => {
    const input = createMockZambdaInput(validBody, { secrets });
    const result = validateWithSchema(UserActivationZambdaInputSchema, input);

    expect(result.userId).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(result.userActivationMode).toBe('activate');
    expect(result.secrets).toBe(secrets);
  });

  test('should return validated params for deactivate mode', () => {
    const input = createMockZambdaInput({ ...validBody, userActivationMode: 'deactivate' }, { secrets });
    const result = validateWithSchema(UserActivationZambdaInputSchema, input);

    expect(result.userActivationMode).toBe('deactivate');
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { body: '', secrets });
    expect(() => validateWithSchema(UserActivationZambdaInputSchema, input)).toThrow();
  });

  test('should throw when secrets is null', () => {
    const input = createMockZambdaInput(validBody, { secrets: null });
    expect(() => validateWithSchema(UserActivationZambdaInputSchema, input)).toThrow();
  });

  test('should throw when userId is missing', () => {
    const { userId: _, ...rest } = validBody;
    const input = createMockZambdaInput(rest, { secrets });
    expect(() => validateWithSchema(UserActivationZambdaInputSchema, input)).toThrow();
  });

  test('should throw when userId is not a valid UUID', () => {
    const input = createMockZambdaInput({ ...validBody, userId: 'not-a-uuid' }, { secrets });
    expect(() => validateWithSchema(UserActivationZambdaInputSchema, input)).toThrow();
  });

  test('should throw when userActivationMode is invalid', () => {
    const input = createMockZambdaInput({ ...validBody, userActivationMode: 'invalid' }, { secrets });
    expect(() => validateWithSchema(UserActivationZambdaInputSchema, input)).toThrow();
  });

  test('should throw when userActivationMode is missing', () => {
    const { userActivationMode: _, ...rest } = validBody;
    const input = createMockZambdaInput(rest, { secrets });
    expect(() => validateWithSchema(UserActivationZambdaInputSchema, input)).toThrow();
  });
});
