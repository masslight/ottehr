import {
  ADDRESS_BOOK_CREDENTIAL_NEEDS_LAST_NAME_MESSAGE,
  ADDRESS_BOOK_LINE2_NEEDS_LINE1_MESSAGE,
  ADDRESS_BOOK_TAG_MESSAGE,
} from 'utils/lib/types/data/address-book';
import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/ehr/address-book/create-address-book-contact/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('create-address-book-contact - validateRequestParameters', () => {
  const secrets = createMockSecrets();

  test('should accept an organization-only contact', () => {
    const result = validateRequestParameters(createMockZambdaInput({ organizationName: 'Acme' }, { secrets }));

    expect(result.contact.organizationName).toBe('Acme');
    expect(result.secrets).toBe(secrets);
  });

  test('should accept a last-name-only contact with phone, fax, email and tags', () => {
    const body = { lastName: 'Doe', phone: '(212) 555-1234', fax: '2125554321', email: 'a@b.co', tags: ['x'] };
    const result = validateRequestParameters(createMockZambdaInput(body, { secrets }));

    expect(result.contact).toEqual(body);
  });

  test('should throw when body is missing', () => {
    expect(() => validateRequestParameters(createMockZambdaInput(null, { secrets }))).toThrow();
  });

  test('should throw when neither organization name nor last name is given', () => {
    expect(() => validateRequestParameters(createMockZambdaInput({ firstName: 'Jane' }, { secrets }))).toThrow();
  });

  test('should throw on an invalid phone number', () => {
    expect(() =>
      validateRequestParameters(createMockZambdaInput({ lastName: 'Doe', phone: '12345' }, { secrets }))
    ).toThrow();
  });

  test('should throw on an invalid email', () => {
    expect(() =>
      validateRequestParameters(createMockZambdaInput({ lastName: 'Doe', email: 'nope' }, { secrets }))
    ).toThrow();
  });

  test('should throw when address line 2 is given without line 1', () => {
    const body = { lastName: 'Doe', address: { line1: ' ', line2: 'Suite 100' } };

    expect(() => validateRequestParameters(createMockZambdaInput(body, { secrets }))).toThrow(
      ADDRESS_BOOK_LINE2_NEEDS_LINE1_MESSAGE
    );
  });

  test('should throw when a credential is given without a last name', () => {
    const body = { organizationName: 'Acme', credential: 'MD' };

    expect(() => validateRequestParameters(createMockZambdaInput(body, { secrets }))).toThrow(
      ADDRESS_BOOK_CREDENTIAL_NEEDS_LAST_NAME_MESSAGE
    );
  });

  test('should trim, lowercase and dedupe tags, and reject FHIR token separators in them', () => {
    const accepted = validateRequestParameters(
      createMockZambdaInput(
        { lastName: 'Doe', tags: [" O'Neil-Peds_1. ", 'PCP ', 'pcp', 'Pediatric   Care', 'pediatric care'] },
        { secrets }
      )
    );
    // Repeated spaces collapse to one: the tag becomes a FHIR code, which allows only single spaces.
    expect(accepted.contact.tags).toEqual(["o'neil-peds_1.", 'pcp', 'pediatric care']);

    for (const tag of ['Peds,Ortho', 'a|b']) {
      expect(() =>
        validateRequestParameters(createMockZambdaInput({ lastName: 'Doe', tags: [tag] }, { secrets }))
      ).toThrow(ADDRESS_BOOK_TAG_MESSAGE);
    }
  });
});
