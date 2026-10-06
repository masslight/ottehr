import { GetOrUploadPatientProfilePhotoInputSchema } from 'utils/lib/types/api/get-patient-profile-photo-url.types';
import { describe, expect, test } from 'vitest';
import { validateWithSchema } from '../../../src/shared/validation';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('get-patient-profile-photo-url - validateRequestParameters', () => {
  const secrets = createMockSecrets();

  describe('upload action', () => {
    test('should return validated params for an upload request', () => {
      const input = createMockZambdaInput(
        { action: 'upload', patientId: '550e8400-e29b-41d4-a716-446655440000' },
        { secrets }
      );
      const result = validateWithSchema(GetOrUploadPatientProfilePhotoInputSchema, input);

      expect(result).toEqual({
        action: 'upload',
        patientId: '550e8400-e29b-41d4-a716-446655440000',
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
      const result = validateWithSchema(GetOrUploadPatientProfilePhotoInputSchema, input);

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
      expect(() => validateWithSchema(GetOrUploadPatientProfilePhotoInputSchema, input)).toThrow();
    });

    test('should throw when action is missing', () => {
      const input = createMockZambdaInput({ patientId: '550e8400-e29b-41d4-a716-446655440000' }, { secrets });
      expect(() => validateWithSchema(GetOrUploadPatientProfilePhotoInputSchema, input)).toThrow();
    });

    test('should throw when action is invalid', () => {
      const input = createMockZambdaInput(
        { action: 'invalid', patientId: '550e8400-e29b-41d4-a716-446655440000' },
        { secrets }
      );
      expect(() => validateWithSchema(GetOrUploadPatientProfilePhotoInputSchema, input)).toThrow();
    });

    test('should throw when upload is missing patientId', () => {
      const input = createMockZambdaInput({ action: 'upload' }, { secrets });
      expect(() => validateWithSchema(GetOrUploadPatientProfilePhotoInputSchema, input)).toThrow();
    });

    test('should throw when download is missing z3PhotoUrl', () => {
      const input = createMockZambdaInput({ action: 'download' }, { secrets });
      expect(() => validateWithSchema(GetOrUploadPatientProfilePhotoInputSchema, input)).toThrow();
    });

    test('should throw when patientId is not a valid UUID', () => {
      const input = createMockZambdaInput({ action: 'upload', patientId: 'patient-123' }, { secrets });
      expect(() => validateWithSchema(GetOrUploadPatientProfilePhotoInputSchema, input)).toThrow();
    });
  });
});
