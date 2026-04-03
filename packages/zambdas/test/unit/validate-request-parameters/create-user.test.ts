import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/ehr/create-user/validateRequestParameters';
import { createMockZambdaInput } from './helpers';

describe('create-user - validateRequestParameters', () => {
  const validBody = {
    email: 'test@example.com',
    applicationID: 'app-123',
    firstName: 'John',
    lastName: 'Doe',
  };

  test('should return validated params when all required fields provided', () => {
    const input = createMockZambdaInput(validBody);
    const result = validateRequestParameters(input);

    expect(result.email).toBe('test@example.com');
    expect(result.applicationID).toBe('app-123');
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

  test('should pass secrets through from input', () => {
    const secrets = { PROJECT_API: 'https://api.test' };
    const input = createMockZambdaInput(validBody, { secrets });
    const result = validateRequestParameters(input);
    expect(result.secrets).toEqual(secrets);
  });
});
