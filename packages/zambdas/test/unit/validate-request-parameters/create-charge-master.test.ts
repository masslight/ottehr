import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/rcm/charge-masters/create-charge-master/validateRequestParameters';
import { createMockZambdaInput } from './helpers';

describe('create-charge-master - validateRequestParameters', () => {
  const validBody = {
    name: 'Standard Charge Master',
    effectiveDate: '2024-01-01',
    description: 'A test charge master',
  };

  test('should return validated params with all fields', () => {
    const input = createMockZambdaInput(validBody);
    const result = validateRequestParameters(input);

    expect(result.name).toBe('Standard Charge Master');
    expect(result.effectiveDate).toBe('2024-01-01');
    expect(result.description).toBe('A test charge master');
    expect(result.secrets).toBeNull();
  });

  test('should default description to empty string when not provided', () => {
    const input = createMockZambdaInput({
      name: 'Test',
      effectiveDate: '2024-01-01',
    });
    const result = validateRequestParameters(input);

    expect(result.description).toBe('');
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { body: '' });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when name is missing', () => {
    const input = createMockZambdaInput({ effectiveDate: '2024-01-01' });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when effectiveDate is missing', () => {
    const input = createMockZambdaInput({ name: 'Test' });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when both name and effectiveDate are missing', () => {
    const input = createMockZambdaInput({ description: 'just a description' });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should pass secrets through from input', () => {
    const secrets = { PROJECT_API: 'https://api.test' };
    const input = createMockZambdaInput(validBody, { secrets });
    const result = validateRequestParameters(input);
    expect(result.secrets).toEqual(secrets);
  });
});
