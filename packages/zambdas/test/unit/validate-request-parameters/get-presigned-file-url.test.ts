import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/patient/get-presigned-file-url/validateRequestParameters';
import { createMockZambdaInput } from './helpers';

describe('get-presigned-file-url - validateRequestParameters', () => {
  const validBody = {
    appointmentID: '123e4567-e89b-12d3-a456-426614174000',
    fileType: 'photo-id-front',
    fileFormat: 'jpg',
  };

  test('should return validated params with all fields', () => {
    const input = createMockZambdaInput(validBody);
    const result = validateRequestParameters(input);

    expect(result.appointmentID).toBe('123e4567-e89b-12d3-a456-426614174000');
    expect(result.fileType).toBe('photo-id-front');
    expect(result.fileFormat).toBe('jpg');
    expect(result.secrets).toBeNull();
  });

  test('should accept all valid file types', () => {
    const fileTypes = [
      'insurance-card-back',
      'insurance-card-back-2',
      'insurance-card-front',
      'insurance-card-front-2',
      'photo-id-front',
      'photo-id-back',
      'school-work-note-template-school',
      'school-work-note-template-work',
    ];
    for (const fileType of fileTypes) {
      const input = createMockZambdaInput({ ...validBody, fileType });
      const result = validateRequestParameters(input);
      expect(result.fileType).toBe(fileType);
    }
  });

  test('should accept patient-photo prefixed file types', () => {
    const input = createMockZambdaInput({ ...validBody, fileType: 'patient-photo-123' });
    const result = validateRequestParameters(input);
    expect(result.fileType).toBe('patient-photo-123');
  });

  test('should accept all valid file formats', () => {
    const formats = ['jpg', 'jpeg', 'png', 'pdf'];
    for (const fileFormat of formats) {
      const input = createMockZambdaInput({ ...validBody, fileFormat });
      const result = validateRequestParameters(input);
      expect(result.fileFormat).toBe(fileFormat);
    }
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { body: '' });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when appointmentID is missing', () => {
    const input = createMockZambdaInput({ fileType: 'photo-id-front', fileFormat: 'jpg' });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when appointmentID is empty string', () => {
    const input = createMockZambdaInput({ ...validBody, appointmentID: '' });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when appointmentID is not a valid UUID', () => {
    const input = createMockZambdaInput({ ...validBody, appointmentID: 'not-a-uuid' });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when fileType is missing', () => {
    const input = createMockZambdaInput({ appointmentID: validBody.appointmentID, fileFormat: 'jpg' });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when fileType is empty string', () => {
    const input = createMockZambdaInput({ ...validBody, fileType: '' });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when fileType is invalid', () => {
    const input = createMockZambdaInput({ ...validBody, fileType: 'invalid-type' });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when fileFormat is missing', () => {
    const input = createMockZambdaInput({ appointmentID: validBody.appointmentID, fileType: 'photo-id-front' });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when fileFormat is empty string', () => {
    const input = createMockZambdaInput({ ...validBody, fileFormat: '' });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when fileFormat is invalid', () => {
    const input = createMockZambdaInput({ ...validBody, fileFormat: 'gif' });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should pass secrets through from input', () => {
    const secrets = { PROJECT_API: 'https://api.test' };
    const input = createMockZambdaInput(validBody, { secrets });
    const result = validateRequestParameters(input);
    expect(result.secrets).toEqual(secrets);
  });
});
