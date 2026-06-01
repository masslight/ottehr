import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/ehr/get-patient-profile-photo-url/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('get-patient-profile-photo-url - validateRequestParameters', () => {
  const secrets = createMockSecrets();

  describe('upload action', () => {
    test('should return validated params for an upload request', () => {
      const input = createMockZambdaInput({ action: 'upload', patientId: 'patient-123' }, { secrets });
      const result = validateRequestParameters(input);

      expect(result).toEqual({
        action: 'upload',
        patientId: 'patient-123',
        secrets,
      });
    });
  });

  describe('download action', () => {
    test('should return validated params for a download request', () => {
      const input = createMockZambdaInput(
        { action: 'download', z3PhotoUrl: 'https://example.com/photo.jpg' },
        { secrets }
      );
      const result = validateRequestParameters(input);

      expect(result).toEqual({
        action: 'download',
        z3PhotoUrl: 'https://example.com/photo.jpg',
        secrets,
      });
    });
  });

  describe('error cases', () => {
    test('should throw when body is missing', () => {
      const input = createMockZambdaInput(null, { secrets });
      expect(() => validateRequestParameters(input)).toThrow();
    });

    test('should throw when action is missing', () => {
      const input = createMockZambdaInput({ patientId: 'patient-123' }, { secrets });
      expect(() => validateRequestParameters(input)).toThrow();
    });

    test('should throw when action is invalid', () => {
      const input = createMockZambdaInput({ action: 'invalid', patientId: 'patient-123' }, { secrets });
      expect(() => validateRequestParameters(input)).toThrow();
    });

    test('should throw when upload is missing patientId', () => {
      const input = createMockZambdaInput({ action: 'upload' }, { secrets });
      expect(() => validateRequestParameters(input)).toThrow();
    });

    test('should throw when download is missing z3PhotoUrl', () => {
      const input = createMockZambdaInput({ action: 'download' }, { secrets });
      expect(() => validateRequestParameters(input)).toThrow();
    });
  });
});
