import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/ehr/create-custom-folder/validateRequestParameters';
import { createMockZambdaInput } from './helpers';

describe('create-custom-folder - validateRequestParameters', () => {
  const validBody = {
    folderName: 'My Custom Folder',
  };

  test('should return validated params with all required fields', () => {
    const input = createMockZambdaInput(validBody);
    const result = validateRequestParameters(input);

    expect(result.folderName).toBe('My Custom Folder');
    expect(result.userToken).toBe('test-token');
    expect(result.secrets).toBeNull();
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { body: '' });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when Authorization header is missing', () => {
    const input = createMockZambdaInput(validBody, { headers: {} });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when folderName is missing', () => {
    const input = createMockZambdaInput({});
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when folderName is empty string', () => {
    const input = createMockZambdaInput({ folderName: '' });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when folderName contains invalid characters', () => {
    const input = createMockZambdaInput({ folderName: 'folder<script>' });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when folderName exceeds max length', () => {
    const input = createMockZambdaInput({ folderName: 'a'.repeat(61) });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should accept folderName with allowed special characters', () => {
    const input = createMockZambdaInput({ folderName: "Test Folder (1) - $100 + tax's @work!" });
    const result = validateRequestParameters(input);
    expect(result.folderName).toBe("Test Folder (1) - $100 + tax's @work!");
  });
});
