import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/ehr/delete-patient-document/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('delete-patient-document - validateRequestParameters', () => {
  const validBody = {
    documentRefId: 'doc-ref-123',
  };

  test('should return validated params with all required fields', () => {
    const input = createMockZambdaInput(validBody, { secrets: createMockSecrets() });
    const result = validateRequestParameters(input);

    expect(result.documentRefId).toBe('doc-ref-123');
    expect(result.secrets).toEqual(createMockSecrets());
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { body: '', secrets: createMockSecrets() });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when documentRefId is missing', () => {
    const input = createMockZambdaInput({}, { secrets: createMockSecrets() });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when documentRefId is not a string', () => {
    const input = createMockZambdaInput({ documentRefId: 123 }, { secrets: createMockSecrets() });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when secrets are missing', () => {
    const input = createMockZambdaInput(validBody);
    expect(() => validateRequestParameters(input)).toThrow();
  });
});
