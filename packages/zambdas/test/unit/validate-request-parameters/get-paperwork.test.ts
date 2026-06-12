import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/patient/paperwork/get-paperwork/validateRequestParameters';
import { createMockZambdaInput } from './helpers';

describe('get-paperwork - validateRequestParameters', () => {
  const validBody = {
    appointmentID: '123e4567-e89b-12d3-a456-426614174000',
  };

  test('should return validated params with appointmentID and authorization', () => {
    const input = createMockZambdaInput(validBody);
    const result = validateRequestParameters(input);

    expect(result.appointmentID).toBe('123e4567-e89b-12d3-a456-426614174000');
    expect(result.secrets).toBeNull();
    expect(result.authorization).toBe('Bearer test-token');
  });

  test('should return validated params with optional dateOfBirth', () => {
    const input = createMockZambdaInput({ ...validBody, dateOfBirth: '1990-01-15' });
    const result = validateRequestParameters(input);

    expect(result.appointmentID).toBe('123e4567-e89b-12d3-a456-426614174000');
    expect(result.dateOfBirth).toBe('1990-01-15');
  });

  test('should allow dateOfBirth to be undefined', () => {
    const input = createMockZambdaInput(validBody);
    const result = validateRequestParameters(input);
    expect(result.dateOfBirth).toBeUndefined();
  });

  test('should pass authorization header through', () => {
    const input = createMockZambdaInput(validBody, {
      headers: { Authorization: 'Bearer my-token' },
    });
    const result = validateRequestParameters(input);
    expect(result.authorization).toBe('Bearer my-token');
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { body: '' });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when body is null', () => {
    const input = createMockZambdaInput(null, { body: null as any });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when appointmentID is missing', () => {
    const input = createMockZambdaInput({});
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when appointmentID is empty string', () => {
    const input = createMockZambdaInput({ appointmentID: '' });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when appointmentID is not a valid UUID', () => {
    const input = createMockZambdaInput({ appointmentID: 'not-a-uuid' });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when dateOfBirth is not a valid date string', () => {
    const input = createMockZambdaInput({ ...validBody, dateOfBirth: 'not-a-date' });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when dateOfBirth is in wrong format', () => {
    const input = createMockZambdaInput({ ...validBody, dateOfBirth: '01/15/1990' });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should pass secrets through from input', () => {
    const secrets = { PROJECT_API: 'https://api.test' };
    const input = createMockZambdaInput(validBody, { secrets });
    const result = validateRequestParameters(input);
    expect(result.secrets).toEqual(secrets);
  });
});
