import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/patient/check-in/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('check-in - validateRequestParameters', () => {
  const secrets = createMockSecrets();

  test('should return validated params with appointmentId', () => {
    const input = createMockZambdaInput({ appointmentId: 'appt-123' }, { secrets });
    const result = validateRequestParameters(input);

    expect(result.appointmentId).toBe('appt-123');
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
    const input = createMockZambdaInput({ appointmentId: 'appt-123' }, { secrets: null });
    expect(() => validateRequestParameters(input)).toThrow('secrets');
  });

  test('should pass when appointmentId is a valid string', () => {
    const input = createMockZambdaInput({ appointmentId: 'any-valid-id' }, { secrets });
    expect(() => validateRequestParameters(input)).not.toThrow();
  });
});
