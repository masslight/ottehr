import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/ehr/list-templates/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('list-templates - validateRequestParameters', () => {
  test('should return validated params when includeVersionData is true', () => {
    const input = createMockZambdaInput({ includeVersionData: true }, { secrets: createMockSecrets() });
    const result = validateRequestParameters(input);

    expect(result.includeVersionData).toBe(true);
    expect(result.secrets).toEqual(createMockSecrets());
  });

  test('should return validated params when includeVersionData is false', () => {
    const input = createMockZambdaInput({ includeVersionData: false }, { secrets: createMockSecrets() });
    const result = validateRequestParameters(input);

    expect(result.includeVersionData).toBe(false);
    expect(result.secrets).toEqual(createMockSecrets());
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { body: '', secrets: createMockSecrets() });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when includeVersionData is missing', () => {
    const input = createMockZambdaInput({}, { secrets: createMockSecrets() });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when includeVersionData is not a boolean', () => {
    const input = createMockZambdaInput({ includeVersionData: 'true' }, { secrets: createMockSecrets() });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when includeVersionData is a number', () => {
    const input = createMockZambdaInput({ includeVersionData: 1 }, { secrets: createMockSecrets() });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when secrets are missing', () => {
    const input = createMockZambdaInput({ includeVersionData: true });
    expect(() => validateRequestParameters(input)).toThrow();
  });
});
