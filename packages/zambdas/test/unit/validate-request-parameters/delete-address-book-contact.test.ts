import { DeleteAddressBookContactInputSchema } from 'utils/lib/types/data/address-book';
import { describe, expect, test } from 'vitest';
import { validateWithSchema } from '../../../src/shared/validation';
import { createMockSecrets, createMockZambdaInput } from './helpers';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('delete-address-book-contact - validateRequestParameters', () => {
  const secrets = createMockSecrets();

  test('should return contactId and secrets', () => {
    const result = validateWithSchema(
      DeleteAddressBookContactInputSchema,
      createMockZambdaInput({ contactId: VALID_UUID }, { secrets })
    );

    expect(result).toEqual({ contactId: VALID_UUID, secrets });
  });

  test('should throw when contactId is not a uuid', () => {
    expect(() =>
      validateWithSchema(DeleteAddressBookContactInputSchema, createMockZambdaInput({ contactId: 'nope' }, { secrets }))
    ).toThrow();
  });

  test('should throw when body is missing', () => {
    expect(() =>
      validateWithSchema(DeleteAddressBookContactInputSchema, createMockZambdaInput(null, { secrets }))
    ).toThrow();
  });
});
