import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/ehr/progress-note-config/admin-update-progress-note-config/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('admin-update-progress-note-config - validateRequestParameters', () => {
  test('should return validated params when mdmRequired is provided', () => {
    const input = createMockZambdaInput({ mdmRequired: false });
    const result = validateRequestParameters(input);

    expect(result.mdmRequired).toBe(false);
    expect(result.secrets).toBeNull();
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { body: '' });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when mdmRequired is missing', () => {
    const input = createMockZambdaInput({});
    expect(() => validateRequestParameters(input)).toThrow('mdmRequired');
  });

  test('should throw when mdmRequired is not a boolean', () => {
    const input = createMockZambdaInput({ mdmRequired: 'yes' });
    expect(() => validateRequestParameters(input)).toThrow('mdmRequired');
  });

  test('should pass secrets through from input', () => {
    const secrets = createMockSecrets();
    const input = createMockZambdaInput({ mdmRequired: true }, { secrets });
    const result = validateRequestParameters(input);
    expect(result.secrets).toEqual(secrets);
  });
});
