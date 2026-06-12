import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/ehr/rename-custom-folder/validateRequestParameters';
import { createMockZambdaInput } from './helpers';

describe('rename-custom-folder - validateRequestParameters', () => {
  const validBody = {
    internalName: 'custom-folder-internal',
    newName: 'Renamed Folder',
  };

  test('should return validated params with all required fields', () => {
    const input = createMockZambdaInput(validBody);
    const result = validateRequestParameters(input);

    expect(result.internalName).toBe('custom-folder-internal');
    expect(result.newName).toBe('Renamed Folder');
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

  test('should throw when internalName is missing', () => {
    const input = createMockZambdaInput({ newName: 'Renamed Folder' });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when newName is missing', () => {
    const input = createMockZambdaInput({ internalName: 'custom-folder-internal' });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when internalName is empty string', () => {
    const input = createMockZambdaInput({ internalName: '', newName: 'Renamed Folder' });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when newName is empty string', () => {
    const input = createMockZambdaInput({ internalName: 'custom-folder-internal', newName: '' });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when newName contains invalid characters', () => {
    const input = createMockZambdaInput({
      internalName: 'custom-folder-internal',
      newName: '<script>alert("xss")</script>',
    });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when newName exceeds max length', () => {
    const input = createMockZambdaInput({ internalName: 'custom-folder-internal', newName: 'a'.repeat(61) });
    expect(() => validateRequestParameters(input)).toThrow();
  });
});
