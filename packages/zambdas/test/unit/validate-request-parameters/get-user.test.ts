import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/ehr/get-user/validateRequestParameters';
import { createMockZambdaInput } from './helpers';

describe('get-user - validateRequestParameters', () => {
  test('should return validated params when userId is provided', () => {
    const input = createMockZambdaInput({ userId: 'user-123' });
    const result = validateRequestParameters(input);

    expect(result.userId).toBe('user-123');
    expect(result.secrets).toBeNull();
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { body: '' });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when userId is undefined', () => {
    const input = createMockZambdaInput({ someField: 'value' });
    expect(() => validateRequestParameters(input)).toThrow('userId');
  });

  test('should pass secrets through from input', () => {
    const secrets = { PROJECT_API: 'https://api.test' };
    const input = createMockZambdaInput({ userId: 'user-123' }, { secrets });
    const result = validateRequestParameters(input);
    expect(result.secrets).toEqual(secrets);
  });
});
