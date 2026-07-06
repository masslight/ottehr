import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/rcm/employers/list-employers/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('list-employers - validateRequestParameters', () => {
  const secrets = createMockSecrets();

  test('should return secrets for a valid request with no body', () => {
    const input = createMockZambdaInput(null, { secrets });
    const result = validateRequestParameters(input);

    expect(result).toEqual({ secrets });
  });

  test('should return secrets for a valid request with a body', () => {
    const input = createMockZambdaInput({}, { secrets });
    const result = validateRequestParameters(input);

    expect(result).toEqual({ secrets });
  });

  test('should return null secrets when no secrets provided', () => {
    const input = createMockZambdaInput(null, { secrets: null });
    const result = validateRequestParameters(input);

    expect(result.secrets).toBeNull();
  });
});
