import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/patient/video-chat-invites/list-invites/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('video-chat-list-invites - validateRequestParameters', () => {
  const secrets = createMockSecrets();

  const validBody = {
    appointmentId: 'appt-abc-123',
  };

  test('should return validated params for a valid request', () => {
    const input = createMockZambdaInput(validBody, { secrets });
    const result = validateRequestParameters(input);

    expect(result).toEqual({
      appointmentId: 'appt-abc-123',
      secrets,
    });
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when appointmentId is missing', () => {
    const input = createMockZambdaInput({}, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when appointmentId is empty string', () => {
    const input = createMockZambdaInput({ appointmentId: '' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });
});
