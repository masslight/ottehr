import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/patient/check-in/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('check-in - validateRequestParameters', () => {
  const secrets = createMockSecrets();

  test('should return validated params with appointmentId', () => {
    const input = createMockZambdaInput({ appointmentId: '550e8400-e29b-41d4-a716-446655440000' }, { secrets });
    const result = validateRequestParameters(input);

    expect(result.appointmentId).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(result.secrets).toEqual(secrets);
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { body: '', secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when appointmentId is undefined', () => {
    const input = createMockZambdaInput({ someField: 'value' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow('appointment');
  });

  test('should throw when secrets are null', () => {
    const input = createMockZambdaInput({ appointmentId: '550e8400-e29b-41d4-a716-446655440000' }, { secrets: null });
    expect(() => validateRequestParameters(input)).toThrow('secrets');
  });

  test('should throw when appointmentId is not a valid UUID', () => {
    const input = createMockZambdaInput({ appointmentId: 'appt-123' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow('appointmentId');
  });

  test('should pass when appointmentId is a valid UUID', () => {
    const input = createMockZambdaInput({ appointmentId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d' }, { secrets });
    expect(() => validateRequestParameters(input)).not.toThrow();
  });
});
