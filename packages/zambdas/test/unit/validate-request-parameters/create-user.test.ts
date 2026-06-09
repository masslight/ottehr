import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/ehr/create-user/validateRequestParameters';
import { createMockZambdaInput } from './helpers';

describe('create-user - validateRequestParameters', () => {
  const validBody = {
    email: 'test@example.com',
    applicationID: '550e8400-e29b-41d4-a716-446655440000',
    firstName: 'John',
    lastName: 'Doe',
  };

  test('should return validated params when all required fields provided', () => {
    const input = createMockZambdaInput(validBody);
    const result = validateRequestParameters(input);

    expect(result.email).toBe('test@example.com');
    expect(result.applicationID).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(result.firstName).toBe('John');
    expect(result.lastName).toBe('Doe');
    expect(result.secrets).toBeNull();
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { body: '' });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when email is missing', () => {
    const { email: _email, ...rest } = validBody;
    const input = createMockZambdaInput(rest);
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when applicationID is missing', () => {
    const { applicationID: _applicationID, ...rest } = validBody;
    const input = createMockZambdaInput(rest);
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when firstName is missing', () => {
    const { firstName: _firstName, ...rest } = validBody;
    const input = createMockZambdaInput(rest);
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when lastName is missing', () => {
    const { lastName: _lastName, ...rest } = validBody;
    const input = createMockZambdaInput(rest);
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when all fields are empty strings', () => {
    const input = createMockZambdaInput({
      email: '',
      applicationID: '',
      firstName: '',
      lastName: '',
    });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when email is not a valid email address', () => {
    const input = createMockZambdaInput({ ...validBody, email: 'not-an-email' });
    expect(() => validateRequestParameters(input)).toThrow('email');
  });

  test('should throw when applicationID is not a valid UUID', () => {
    const input = createMockZambdaInput({ ...validBody, applicationID: 'app-123' });
    expect(() => validateRequestParameters(input)).toThrow('applicationID');
  });

  test('should pass secrets through from input', () => {
    const secrets = { PROJECT_API: 'https://api.test' };
    const input = createMockZambdaInput(validBody, { secrets });
    const result = validateRequestParameters(input);
    expect(result.secrets).toEqual(secrets);
  });
});
