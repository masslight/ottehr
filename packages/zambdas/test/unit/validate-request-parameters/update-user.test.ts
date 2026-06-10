import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/ehr/update-user/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('update-user - validateRequestParameters', () => {
  const secrets = createMockSecrets();

  const validBody = {
    userId: '550e8400-e29b-41d4-a716-446655440000',
  };

  test('should return validated params with only userId', () => {
    const input = createMockZambdaInput(validBody, { secrets });
    const result = validateRequestParameters(input);

    expect(result.userId).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(result.secrets).toBe(secrets);
  });

  test('should return validated params with all optional fields', () => {
    const fullBody = {
      userId: '550e8400-e29b-41d4-a716-446655440000',
      firstName: ' John ',
      middleName: ' M ',
      lastName: ' Doe ',
      providerType: 'MD' as const,
      selectedRoles: ['Provider' as const],
      phoneNumber: '+12223334444',
      npi: '1234567893',
      birthDate: '1990-01-01',
      faxNumber: '1234567890',
      addressLine1: '123 Main St',
      addressLine2: 'Suite 1',
      addressCity: 'Springfield',
      addressState: 'IL',
      addressZip: '62701',
    };
    const input = createMockZambdaInput(fullBody, { secrets });
    const result = validateRequestParameters(input);

    expect(result.firstName).toBe('John');
    expect(result.middleName).toBe('M');
    expect(result.lastName).toBe('Doe');
    expect(result.providerType).toBe('MD');
  });

  test('should throw when secrets are missing', () => {
    const input = createMockZambdaInput(validBody);
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { body: '', secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when userId is missing', () => {
    const input = createMockZambdaInput({}, { secrets });
    expect(() => validateRequestParameters(input)).toThrow('userId');
  });

  test('should throw when userId is not a valid UUID', () => {
    const input = createMockZambdaInput({ userId: 'user-123' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when phoneNumber is invalid', () => {
    const input = createMockZambdaInput({ ...validBody, phoneNumber: 'not-a-phone' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow('phone');
  });

  test('should throw when NPI is invalid for provider role', () => {
    const input = createMockZambdaInput({ ...validBody, selectedRoles: ['Provider'], npi: 'invalid-npi' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow('NPI');
  });

  test('should throw when selectedRoles is empty array', () => {
    const input = createMockZambdaInput({ ...validBody, selectedRoles: [] }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow('role');
  });

  test('should throw when selectedRoles contains invalid role', () => {
    const input = createMockZambdaInput({ ...validBody, selectedRoles: ['InvalidRole'] }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow('Invalid enum value');
  });

  test('should throw when providerType is invalid', () => {
    const input = createMockZambdaInput({ ...validBody, providerType: 'INVALID' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow('providerType');
  });

  test('should throw when providerType is other but providerTypeText is missing', () => {
    const input = createMockZambdaInput({ ...validBody, providerType: 'other' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow('providerTypeText');
  });

  test('should throw when providerType is other and providerTypeText is empty', () => {
    const input = createMockZambdaInput({ ...validBody, providerType: 'other', providerTypeText: '   ' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow('providerTypeText');
  });

  test('should trim string fields', () => {
    const input = createMockZambdaInput(
      {
        userId: '550e8400-e29b-41d4-a716-446655440000',
        firstName: '  John  ',
        lastName: '  Doe  ',
        phoneNumber: '+12223334444',
        npi: ' 1234567893 ',
      },
      { secrets }
    );
    const result = validateRequestParameters(input);

    expect(result.firstName).toBe('John');
    expect(result.lastName).toBe('Doe');
    expect(result.phoneNumber).toBe('+12223334444');
    expect(result.npi).toBe('1234567893');
  });

  test('should accept valid providerType "other" with providerTypeText', () => {
    const input = createMockZambdaInput(
      { ...validBody, providerType: 'other', providerTypeText: 'Custom Type' },
      { secrets }
    );
    const result = validateRequestParameters(input);
    expect(result.providerType).toBe('other');
    expect(result.providerTypeText).toBe('Custom Type');
  });
});
