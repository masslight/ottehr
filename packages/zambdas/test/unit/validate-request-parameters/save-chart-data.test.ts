import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/ehr/save-chart-data/validateRequestParameters';
import { createMockZambdaInput } from './helpers';

describe('save-chart-data - validateRequestParameters', () => {
  const validBody = {
    encounterId: 'enc-123',
    chartDataResourceType: 'vitals',
    data: { weight: 70 },
  };

  test('should return validated params with encounterId', () => {
    const input = createMockZambdaInput(validBody);
    const result = validateRequestParameters(input);

    expect(result.encounterId).toBe('enc-123');
    expect(result.userToken).toBe('test-token');
    expect(result.secrets).toBeNull();
  });

  test('should spread all body data into result', () => {
    const input = createMockZambdaInput(validBody);
    const result = validateRequestParameters(input);

    expect(result).toHaveProperty('chartDataResourceType', 'vitals');
    expect(result).toHaveProperty('data', { weight: 70 });
  });

  test('should extract Bearer token from Authorization header', () => {
    const input = createMockZambdaInput(validBody, {
      headers: { Authorization: 'Bearer my-special-token' },
    });
    const result = validateRequestParameters(input);

    expect(result.userToken).toBe('my-special-token');
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { body: '' });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when encounterId is undefined', () => {
    const input = createMockZambdaInput({ someField: 'value' });
    expect(() => validateRequestParameters(input)).toThrow('encounterId');
  });

  test('should throw when Authorization header is missing', () => {
    const input = createMockZambdaInput(validBody, {
      headers: {},
    });
    expect(() => validateRequestParameters(input)).toThrow('Authorization');
  });

  test('should pass secrets through from input', () => {
    const secrets = { PROJECT_API: 'https://api.test' };
    const input = createMockZambdaInput(validBody, { secrets });
    const result = validateRequestParameters(input);
    expect(result.secrets).toEqual(secrets);
  });
});
