import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/rcm/charge-masters/delete-charge-master/validateRequestParameters';
import { createMockZambdaInput } from './helpers';

describe('delete-charge-master - validateRequestParameters', () => {
  const validBody = {
    id: '123e4567-e89b-12d3-a456-426614174000',
  };

  test('should return validated params with id', () => {
    const input = createMockZambdaInput(validBody);
    const result = validateRequestParameters(input);

    expect(result.id).toBe('123e4567-e89b-12d3-a456-426614174000');
    expect(result.secrets).toBeNull();
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { body: '' });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when id is missing', () => {
    const input = createMockZambdaInput({});
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when id is empty string', () => {
    const input = createMockZambdaInput({ id: '' });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should pass secrets through from input', () => {
    const secrets = { PROJECT_API: 'https://api.test' };
    const input = createMockZambdaInput(validBody, { secrets });
    const result = validateRequestParameters(input);
    expect(result.secrets).toEqual(secrets);
  });
});
