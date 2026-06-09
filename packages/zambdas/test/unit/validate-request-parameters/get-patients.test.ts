import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/patient/get-patients/validateRequestParameters';
import { createMockZambdaInput } from './helpers';

describe('get-patients - validateRequestParameters', () => {
  test('should return secrets from input (no body validation)', () => {
    const input = createMockZambdaInput({});
    const result = validateRequestParameters(input);

    expect(result.secrets).toBeNull();
  });

  test('should pass secrets through from input', () => {
    const secrets = { PROJECT_API: 'https://api.test' };
    const input = createMockZambdaInput({}, { secrets });
    const result = validateRequestParameters(input);
    expect(result.secrets).toEqual(secrets);
  });

  test('should succeed even with no body', () => {
    const input = createMockZambdaInput(null, { body: null });
    expect(() => validateRequestParameters(input)).not.toThrow();
  });
});
