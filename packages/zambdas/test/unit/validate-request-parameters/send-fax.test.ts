import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/ehr/send-fax/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('send-fax - validateRequestParameters', () => {
  const secrets = createMockSecrets();

  test('should return validated params for a valid request', () => {
    const input = createMockZambdaInput(
      { appointmentId: '550e8400-e29b-41d4-a716-446655440000', faxNumber: '2125551234' },
      { secrets }
    );
    const result = validateRequestParameters(input);

    expect(result).toEqual({
      appointmentId: '550e8400-e29b-41d4-a716-446655440000',
      faxNumber: '+12125551234',
      secrets,
    });
  });

  test('should throw when appointmentId is not a valid UUID', () => {
    const input = createMockZambdaInput({ appointmentId: 'appt-123', faxNumber: '2125551234' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should prepend +1 to the fax number', () => {
    const input = createMockZambdaInput(
      { appointmentId: '550e8400-e29b-41d4-a716-446655440000', faxNumber: '5551234567' },
      { secrets }
    );
    const result = validateRequestParameters(input);

    expect(result.faxNumber).toBe('+15551234567');
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when Authorization header is missing', () => {
    const input = createMockZambdaInput(
      { appointmentId: '550e8400-e29b-41d4-a716-446655440000', faxNumber: '2125551234' },
      { secrets, headers: {} as any }
    );
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when appointmentId is missing', () => {
    const input = createMockZambdaInput({ faxNumber: '2125551234' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when faxNumber is missing', () => {
    const input = createMockZambdaInput({ appointmentId: '550e8400-e29b-41d4-a716-446655440000' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when both appointmentId and faxNumber are missing', () => {
    const input = createMockZambdaInput({}, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when faxNumber is not a valid phone number', () => {
    const input = createMockZambdaInput(
      { appointmentId: '550e8400-e29b-41d4-a716-446655440000', faxNumber: '123' },
      { secrets }
    );
    expect(() => validateRequestParameters(input)).toThrow();
  });
});
