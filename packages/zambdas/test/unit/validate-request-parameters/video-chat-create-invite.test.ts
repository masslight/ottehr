import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/patient/video-chat-invites/create-invite/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('video-chat-create-invite - validateRequestParameters', () => {
  const secrets = createMockSecrets();

  const validBodyWithEmail = {
    appointmentId: 'appt-123',
    firstName: 'Jane',
    lastName: 'Doe',
    emailAddress: 'jane@example.com',
  };

  const validBodyWithPhone = {
    appointmentId: 'appt-123',
    firstName: 'Jane',
    lastName: 'Doe',
    phoneNumber: '5551234567',
  };

  const validBodyWithBoth = {
    appointmentId: 'appt-123',
    firstName: 'Jane',
    lastName: 'Doe',
    emailAddress: 'jane@example.com',
    phoneNumber: '5551234567',
  };

  test('should return validated params with email only', () => {
    const input = createMockZambdaInput(validBodyWithEmail, { secrets });
    const result = validateRequestParameters(input);

    expect(result).toEqual({
      appointmentId: 'appt-123',
      firstName: 'Jane',
      lastName: 'Doe',
      emailAddress: 'jane@example.com',
      phoneNumber: undefined,
      secrets,
    });
  });

  test('should return validated params with phone only', () => {
    const input = createMockZambdaInput(validBodyWithPhone, { secrets });
    const result = validateRequestParameters(input);

    expect(result).toMatchObject({
      appointmentId: 'appt-123',
      firstName: 'Jane',
      lastName: 'Doe',
      phoneNumber: '5551234567',
      secrets,
    });
  });

  test('should return validated params with both email and phone', () => {
    const input = createMockZambdaInput(validBodyWithBoth, { secrets });
    const result = validateRequestParameters(input);

    expect(result).toMatchObject({
      appointmentId: 'appt-123',
      firstName: 'Jane',
      lastName: 'Doe',
      emailAddress: 'jane@example.com',
      phoneNumber: '5551234567',
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

  test('should throw when firstName is missing', () => {
    const { firstName: _omit, ...rest } = validBodyWithEmail;
    const input = createMockZambdaInput(rest, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when lastName is missing', () => {
    const { lastName: _omit, ...rest } = validBodyWithEmail;
    const input = createMockZambdaInput(rest, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when neither emailAddress nor phoneNumber is provided', () => {
    const input = createMockZambdaInput({ appointmentId: 'appt-123', firstName: 'Jane', lastName: 'Doe' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when emailAddress is invalid', () => {
    const input = createMockZambdaInput({ ...validBodyWithEmail, emailAddress: 'not-an-email' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });
});
