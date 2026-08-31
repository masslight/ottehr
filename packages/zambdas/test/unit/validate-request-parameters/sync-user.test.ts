import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/ehr/sync-user/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('sync-user - validateRequestParameters', () => {
  const secrets = createMockSecrets();

  test('should return secrets from input', () => {
    const input = createMockZambdaInput({}, { secrets });
    const result = validateRequestParameters(input);

    expect(result.secrets).toBe(secrets);
  });

  test('should throw MISSING_REQUEST_SECRETS when secrets is null', () => {
    const input = createMockZambdaInput({}, { secrets: null });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should work without a body', () => {
    const input = createMockZambdaInput(null, { body: '', secrets });
    const result = validateRequestParameters(input);

    expect(result.secrets).toBe(secrets);
  });
});
