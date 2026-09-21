import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/ehr/address-book/search-address-book/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('search-address-book - validateRequestParameters', () => {
  const secrets = createMockSecrets();

  test('should return secrets and no tag for a request with no body', () => {
    const result = validateRequestParameters(createMockZambdaInput(null, { secrets }));

    expect(result).toEqual({ tag: undefined, secrets });
  });

  test('should return the tag filter when given', () => {
    const result = validateRequestParameters(createMockZambdaInput({ tag: ' cardiology ' }, { secrets }));

    expect(result.tag).toBe('cardiology');
  });

  test('should throw when tag is empty', () => {
    expect(() => validateRequestParameters(createMockZambdaInput({ tag: '' }, { secrets }))).toThrow();
  });
});
