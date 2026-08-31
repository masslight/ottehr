import { describe, expect, test } from 'vitest';
import {
  validateInput,
  validateSecrets,
} from '../../../src/patient/video-chat-invites/create-waiting-room-notification-task/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('video-chat-waiting-room-notification - validateInput', () => {
  const validUuid = '550e8400-e29b-41d4-a716-446655440000';

  const validBody = {
    appointmentId: validUuid,
  };

  test('should return validated input for a valid request', async () => {
    const input = createMockZambdaInput(validBody);
    const result = await validateInput(input);

    expect(result).toEqual({
      body: {
        appointmentId: validUuid,
      },
    });
  });

  test('should throw when appointmentId is missing', async () => {
    const input = createMockZambdaInput({});
    await expect(validateInput(input)).rejects.toThrow();
  });

  test('should throw when appointmentId is not a valid UUID', async () => {
    const input = createMockZambdaInput({ appointmentId: 'not-a-uuid' });
    await expect(validateInput(input)).rejects.toThrow();
  });

  test('should throw when body is missing', async () => {
    const input = createMockZambdaInput(null);
    await expect(validateInput(input)).rejects.toThrow();
  });
});

describe('video-chat-waiting-room-notification - validateSecrets', () => {
  test('should return secrets when all required secrets are present', () => {
    const secrets = createMockSecrets({
      AUTH0_ENDPOINT: 'https://auth.example.com',
      AUTH0_CLIENT: 'client-id',
      AUTH0_SECRET: 'secret',
      AUTH0_AUDIENCE: 'audience',
      FHIR_API: 'https://fhir.api',
      PROJECT_API: 'https://project.api',
    });

    const result = validateSecrets(secrets);
    expect(result.AUTH0_ENDPOINT).toBe('https://auth.example.com');
    expect(result.AUTH0_CLIENT).toBe('client-id');
  });

  test('should throw when secrets is null', () => {
    expect(() => validateSecrets(null)).toThrow();
  });

  test('should throw when required secret keys are missing', () => {
    const secrets = createMockSecrets({
      AUTH0_ENDPOINT: 'https://auth.example.com',
      // missing AUTH0_CLIENT, AUTH0_SECRET, AUTH0_AUDIENCE
    });
    expect(() => validateSecrets(secrets)).toThrow();
  });
});
