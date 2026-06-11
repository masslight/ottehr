import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/rcm/charge-masters/list-charge-masters/validateRequestParameters';
import { createMockZambdaInput } from './helpers';

describe('list-charge-masters - validateRequestParameters', () => {
  test('should return secrets from input', () => {
    const secrets = { PROJECT_API: 'https://api.test' };
    const input = createMockZambdaInput({}, { secrets });
    const result = validateRequestParameters(input);
    expect(result.secrets).toEqual(secrets);
  });

  test('should return null secrets when none provided', () => {
    const input = createMockZambdaInput({});
    const result = validateRequestParameters(input);
    expect(result.secrets).toBeNull();
  });

  test('should not throw when body is empty', () => {
    const input = createMockZambdaInput(null, { body: null as any });
    expect(() => validateRequestParameters(input)).not.toThrow();
  });
});
