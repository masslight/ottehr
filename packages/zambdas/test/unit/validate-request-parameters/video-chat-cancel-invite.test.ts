import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/patient/video-chat-invites/cancel-invite/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('video-chat-cancel-invite - validateRequestParameters', () => {
  const secrets = createMockSecrets();

  const validBodyWithEmail = {
    appointmentId: 'appt-123',
    emailAddress: 'test@example.com',
  };

  const validBodyWithPhone = {
    appointmentId: 'appt-123',
    phoneNumber: '(555) 123-4567',
  };

  const validBodyWithBoth = {
    appointmentId: 'appt-123',
    emailAddress: 'test@example.com',
    phoneNumber: '(555) 123-4567',
  };

  test('should return validated params with email only', () => {
    const input = createMockZambdaInput(validBodyWithEmail, { secrets });
    const result = validateRequestParameters(input);

    expect(result).toEqual({
      appointmentId: 'appt-123',
      emailAddress: 'test@example.com',
      phoneNumber: undefined,
      secrets,
    });
  });

  test('should return validated params with phone only', () => {
    const input = createMockZambdaInput(validBodyWithPhone, { secrets });
    const result = validateRequestParameters(input);

    expect(result).toEqual({
      appointmentId: 'appt-123',
      emailAddress: undefined,
      phoneNumber: '(555) 123-4567',
      secrets,
    });
  });

  test('should return validated params with both email and phone', () => {
    const input = createMockZambdaInput(validBodyWithBoth, { secrets });
    const result = validateRequestParameters(input);

    expect(result).toMatchObject({
      appointmentId: 'appt-123',
      emailAddress: 'test@example.com',
      phoneNumber: '(555) 123-4567',
      secrets,
    });
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when appointmentId is missing', () => {
    const { appointmentId: _omit, ...rest } = validBodyWithEmail;
    const input = createMockZambdaInput(rest, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when neither emailAddress nor phoneNumber is provided', () => {
    const input = createMockZambdaInput({ appointmentId: 'appt-123' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when emailAddress is invalid', () => {
    const input = createMockZambdaInput({ appointmentId: 'appt-123', emailAddress: 'not-an-email' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when phoneNumber is invalid', () => {
    const input = createMockZambdaInput({ appointmentId: 'appt-123', phoneNumber: '1234567890' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });
});
