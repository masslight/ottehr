import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/ehr/delete-custom-folder/validateRequestParameters';
import { createMockZambdaInput } from './helpers';

describe('delete-custom-folder - validateRequestParameters', () => {
  const validBody = {
    internalName: 'custom-folder-internal',
  };

  test('should return validated params with all required fields', () => {
    const input = createMockZambdaInput(validBody);
    const result = validateRequestParameters(input);

    expect(result.internalName).toBe('custom-folder-internal');
    expect(result.userToken).toBe('test-token');
    expect(result.secrets).toBeNull();
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { body: '' });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when Authorization header is missing', () => {
    const input = createMockZambdaInput(validBody, { headers: {} });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when internalName is missing', () => {
    const input = createMockZambdaInput({});
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when internalName is empty string', () => {
    const input = createMockZambdaInput({ internalName: '' });
    expect(() => validateRequestParameters(input)).toThrow();
  });
});
