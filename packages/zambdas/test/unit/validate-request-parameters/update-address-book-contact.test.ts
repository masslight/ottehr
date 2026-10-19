import { ADDRESS_BOOK_CREDENTIAL_NEEDS_LAST_NAME_MESSAGE } from 'utils/lib/types/data/address-book';
import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/ehr/address-book/update-address-book-contact/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('update-address-book-contact - validateRequestParameters', () => {
  const secrets = createMockSecrets();

  test('should split contactId from the contact fields', () => {
    const input = createMockZambdaInput({ contactId: VALID_UUID, lastName: 'Doe', tags: [] }, { secrets });
    const result = validateRequestParameters(input);

    expect(result).toEqual({ contactId: VALID_UUID, contact: { lastName: 'Doe', tags: [] }, secrets });
  });

  test('should throw when contactId is not a uuid', () => {
    expect(() =>
      validateRequestParameters(createMockZambdaInput({ contactId: 'nope', lastName: 'Doe' }, { secrets }))
    ).toThrow();
  });

  test('should throw when neither organization name nor last name is given', () => {
    expect(() => validateRequestParameters(createMockZambdaInput({ contactId: VALID_UUID }, { secrets }))).toThrow();
  });

  test('should throw when body is missing', () => {
    expect(() => validateRequestParameters(createMockZambdaInput(null, { secrets }))).toThrow();
  });

  test('should throw when a credential is given without a last name', () => {
    const body = { contactId: VALID_UUID, organizationName: 'Acme', credential: 'MD' };

    expect(() => validateRequestParameters(createMockZambdaInput(body, { secrets }))).toThrow(
      ADDRESS_BOOK_CREDENTIAL_NEEDS_LAST_NAME_MESSAGE
    );
  });
});
