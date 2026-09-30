import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/ehr/address-book/delete-address-book-contact/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('delete-address-book-contact - validateRequestParameters', () => {
  const secrets = createMockSecrets();

  test('should return contactId and secrets', () => {
    const result = validateRequestParameters(createMockZambdaInput({ contactId: VALID_UUID }, { secrets }));

    expect(result).toEqual({ contactId: VALID_UUID, secrets });
  });

  test('should throw when contactId is not a uuid', () => {
    expect(() => validateRequestParameters(createMockZambdaInput({ contactId: 'nope' }, { secrets }))).toThrow();
  });

  test('should throw when body is missing', () => {
    expect(() => validateRequestParameters(createMockZambdaInput(null, { secrets }))).toThrow();
  });
});
