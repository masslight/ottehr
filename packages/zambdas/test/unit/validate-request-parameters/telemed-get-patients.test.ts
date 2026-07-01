import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/patient/telemed-get-patients/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('telemed-get-patients - validateRequestParameters', () => {
  test('should return secrets from input (no body validation)', () => {
    const input = createMockZambdaInput({});
    const result = validateRequestParameters(input);

    expect(result.secrets).toBeNull();
  });

  test('should pass secrets through from input', () => {
    const secrets = createMockSecrets();
    const input = createMockZambdaInput({}, { secrets });
    const result = validateRequestParameters(input);
    expect(result.secrets).toEqual(secrets);
  });

  test('should succeed even with no body', () => {
    const input = createMockZambdaInput(null, { body: null });
    expect(() => validateRequestParameters(input)).not.toThrow();
  });

  test('should succeed with null secrets', () => {
    const input = createMockZambdaInput({}, { secrets: null });
    const result = validateRequestParameters(input);
    expect(result.secrets).toBeNull();
  });
});
