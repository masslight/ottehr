import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/ehr/user-activation/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('user-activation - validateRequestParameters', () => {
  const secrets = createMockSecrets();

  const validBody = {
    userId: '550e8400-e29b-41d4-a716-446655440000',
    mode: 'activate',
  };

  test('should return validated params for activate mode', () => {
    const input = createMockZambdaInput(validBody, { secrets });
    const result = validateRequestParameters(input);

    expect(result.userId).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(result.mode).toBe('activate');
    expect(result.secrets).toBe(secrets);
  });

  test('should return validated params for deactivate mode', () => {
    const input = createMockZambdaInput({ ...validBody, mode: 'deactivate' }, { secrets });
    const result = validateRequestParameters(input);

    expect(result.mode).toBe('deactivate');
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { body: '', secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when secrets is null', () => {
    const input = createMockZambdaInput(validBody, { secrets: null });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when userId is missing', () => {
    const { userId: _, ...rest } = validBody;
    const input = createMockZambdaInput(rest, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when userId is not a valid UUID', () => {
    const input = createMockZambdaInput({ ...validBody, userId: 'not-a-uuid' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when mode is invalid', () => {
    const input = createMockZambdaInput({ ...validBody, mode: 'invalid' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when mode is missing', () => {
    const { mode: _, ...rest } = validBody;
    const input = createMockZambdaInput(rest, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });
});
