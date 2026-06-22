import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/ehr/get-patient-instructions/validateRequestParameters';
import { createMockZambdaInput } from './helpers';

describe('get-patient-instructions - validateRequestParameters', () => {
  test('should return validated params with type provider', () => {
    const input = createMockZambdaInput({ type: 'provider' });
    const result = validateRequestParameters(input);

    expect(result.type).toBe('provider');
    expect(result.userToken).toBe('test-token');
    expect(result.secrets).toBeNull();
  });

  test('should return validated params with type organization', () => {
    const input = createMockZambdaInput({ type: 'organization' });
    const result = validateRequestParameters(input);

    expect(result.type).toBe('organization');
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { body: '' });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when Authorization header is missing', () => {
    const input = createMockZambdaInput({ type: 'provider' }, { headers: { Authorization: undefined as any } });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when type is missing', () => {
    const input = createMockZambdaInput({});
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when type is an invalid value', () => {
    const input = createMockZambdaInput({ type: 'invalid-type' });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should extract Bearer token from Authorization header', () => {
    const input = createMockZambdaInput({ type: 'provider' }, { headers: { Authorization: 'Bearer my-token' } });
    const result = validateRequestParameters(input);
    expect(result.userToken).toBe('my-token');
  });
});
