import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/rcm/employers/create-employer/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('create-employer - validateRequestParameters', () => {
  const secrets = createMockSecrets();

  test('should return validated params for a valid request with only name', () => {
    const input = createMockZambdaInput({ name: 'Acme Corp' }, { secrets });
    const result = validateRequestParameters(input);

    expect(result).toEqual({
      name: 'Acme Corp',
      active: undefined,
      category: undefined,
      identifier: undefined,
      address: undefined,
      contact: undefined,
      secrets,
    });
  });

  test('should return validated params with all optional fields', () => {
    const input = createMockZambdaInput(
      {
        name: 'Acme Corp',
        active: true,
        category: 'Occupational Medicine',
        identifier: { system: 'http://example.com', value: 'emp-001' },
        address: { line: ['123 Main St'], city: 'Springfield', state: 'IL', postalCode: '62701', country: 'US' },
        contact: { phone: '2125551234', fax: '2125554321', email: 'hr@acme.com', notes: 'Test notes' },
      },
      { secrets }
    );
    const result = validateRequestParameters(input);

    expect(result.name).toBe('Acme Corp');
    expect(result.active).toBe(true);
    expect(result.category).toBe('Occupational Medicine');
    expect(result.identifier).toEqual({ system: 'http://example.com', value: 'emp-001' });
    expect(result.secrets).toBe(secrets);
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when name is missing', () => {
    const input = createMockZambdaInput({ active: true }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when name is an empty string', () => {
    const input = createMockZambdaInput({ name: '' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when category is an empty string', () => {
    const input = createMockZambdaInput({ name: 'Acme', category: '' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when active is not a boolean', () => {
    const input = createMockZambdaInput({ name: 'Acme', active: 'yes' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });
});
