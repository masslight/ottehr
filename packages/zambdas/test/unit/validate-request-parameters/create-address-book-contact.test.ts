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
});
