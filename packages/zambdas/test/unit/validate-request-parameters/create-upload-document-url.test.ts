import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/ehr/create-upload-document-url/validateRequestParameters';
import { createMockZambdaInput } from './helpers';

describe('create-upload-document-url - validateRequestParameters', () => {
  const validBody = {
    patientId: 'patient-123',
    fileFolderId: 'folder-456',
    fileName: 'report.pdf',
  };

  test('should return validated params with all fields', () => {
    const input = createMockZambdaInput(validBody);
    const result = validateRequestParameters(input);

    expect(result.patientId).toBe('patient-123');
    expect(result.fileFolderId).toBe('folder-456');
    expect(result.fileName).toBe('report.pdf');
    expect(result.userToken).toBe('test-token');
    expect(result.secrets).toBeNull();
  });

  test('should extract Bearer token from Authorization header', () => {
    const input = createMockZambdaInput(validBody, {
      headers: { Authorization: 'Bearer custom-token-abc' },
    });
    const result = validateRequestParameters(input);

    expect(result.userToken).toBe('custom-token-abc');
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { body: '' });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should return undefined fields when body fields are missing', () => {
    const input = createMockZambdaInput({});
    const result = validateRequestParameters(input);

    expect(result.patientId).toBeUndefined();
    expect(result.fileFolderId).toBeUndefined();
    expect(result.fileName).toBeUndefined();
  });

  test('should pass secrets through from input', () => {
    const secrets = { PROJECT_API: 'https://api.test' };
    const input = createMockZambdaInput(validBody, { secrets });
    const result = validateRequestParameters(input);
    expect(result.secrets).toEqual(secrets);
  });
});
