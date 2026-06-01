import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/ehr/create-resources-from-audio-recording/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('create-resources-from-audio-recording - validateRequestParameters', () => {
  const secrets = createMockSecrets();
  const validBody = {
    z3URL: 'https://project-api.zapehr.com/some/path/to/file.mp3',
    visitID: 'visit-123',
    duration: 120,
  };

  test('should return validated params for a valid request', () => {
    const input = createMockZambdaInput(validBody, { secrets });
    const result = validateRequestParameters(input);

    expect(result).toEqual({
      z3URL: 'https://project-api.zapehr.com/some/path/to/file.mp3',
      visitID: 'visit-123',
      duration: 120,
      userToken: 'test-token',
      secrets,
    });
  });

  test('should accept request without duration (optional)', () => {
    const input = createMockZambdaInput({ z3URL: validBody.z3URL, visitID: 'visit-123' }, { secrets });
    const result = validateRequestParameters(input);

    expect(result.duration).toBeUndefined();
    expect(result.visitID).toBe('visit-123');
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when z3URL is missing', () => {
    const input = createMockZambdaInput({ visitID: 'visit-123' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when z3URL does not start with the required prefix', () => {
    const input = createMockZambdaInput(
      { z3URL: 'https://other-domain.com/file.mp3', visitID: 'visit-123' },
      { secrets }
    );
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when visitID is missing', () => {
    const input = createMockZambdaInput({ z3URL: validBody.z3URL }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should extract bearer token from Authorization header', () => {
    const input = createMockZambdaInput(validBody, {
      secrets,
      headers: { Authorization: 'Bearer my-custom-token' },
    });
    const result = validateRequestParameters(input);

    expect(result.userToken).toBe('my-custom-token');
  });
});
