import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/ehr/admin-get-template-detail/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('admin-get-template-detail - validateRequestParameters', () => {
  const validBody = {
    templateId: 'template-xyz',
  };

  test('should return validated params with all required fields', () => {
    const input = createMockZambdaInput(validBody, { secrets: createMockSecrets() });
    const result = validateRequestParameters(input);

    expect(result.templateId).toBe('template-xyz');
    expect(result.secrets).toEqual(createMockSecrets());
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { body: '', secrets: createMockSecrets() });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when templateId is missing', () => {
    const input = createMockZambdaInput({}, { secrets: createMockSecrets() });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when templateId is empty string', () => {
    const input = createMockZambdaInput({ templateId: '' }, { secrets: createMockSecrets() });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when templateId is whitespace only', () => {
    const input = createMockZambdaInput({ templateId: '   ' }, { secrets: createMockSecrets() });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when templateId is not a string', () => {
    const input = createMockZambdaInput({ templateId: 123 }, { secrets: createMockSecrets() });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when secrets are missing', () => {
    const input = createMockZambdaInput(validBody);
    expect(() => validateRequestParameters(input)).toThrow();
  });
});
