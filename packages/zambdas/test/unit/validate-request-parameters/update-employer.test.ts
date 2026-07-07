import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/rcm/employers/update-employer/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('update-employer - validateRequestParameters', () => {
  const secrets = createMockSecrets();

  test('should return validated params for a valid request with only employerId', () => {
    const input = createMockZambdaInput({ employerId: VALID_UUID }, { secrets });
    const result = validateRequestParameters(input);

    expect(result).toEqual({
      employerId: VALID_UUID,
      name: undefined,
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
        employerId: VALID_UUID,
        name: 'Acme Corp Updated',
        active: false,
        category: 'General',
        identifier: { value: 'emp-999' },
        address: { city: 'Chicago' },
        contact: { phone: '3125551234' },
      },
      { secrets }
    );
    const result = validateRequestParameters(input);

    expect(result.employerId).toBe(VALID_UUID);
    expect(result.name).toBe('Acme Corp Updated');
    expect(result.active).toBe(false);
    expect(result.secrets).toBe(secrets);
  });

  test('should accept null for identifier, address, contact', () => {
    const input = createMockZambdaInput(
      { employerId: VALID_UUID, identifier: null, address: null, contact: null },
      { secrets }
    );
    const result = validateRequestParameters(input);

    expect(result.identifier).toBeNull();
    expect(result.address).toBeNull();
    expect(result.contact).toBeNull();
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when employerId is missing', () => {
    const input = createMockZambdaInput({ name: 'Acme' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when employerId is not a valid UUID', () => {
    const input = createMockZambdaInput({ employerId: 'not-a-uuid' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when name is an empty string', () => {
    const input = createMockZambdaInput({ employerId: VALID_UUID, name: '' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when category is an empty string', () => {
    const input = createMockZambdaInput({ employerId: VALID_UUID, category: '' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when active is not a boolean', () => {
    const input = createMockZambdaInput({ employerId: VALID_UUID, active: 'true' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });
});
