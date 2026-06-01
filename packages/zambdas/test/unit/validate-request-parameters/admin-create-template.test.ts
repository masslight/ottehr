import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/ehr/admin-create-template/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('admin-create-template - validateRequestParameters', () => {
  const validBody = {
    encounterId: 'encounter-123',
    templateName: 'My Template',
  };

  test('should return validated params with all required fields', () => {
    const input = createMockZambdaInput(validBody, { secrets: createMockSecrets() });
    const result = validateRequestParameters(input);

    expect(result.encounterId).toBe('encounter-123');
    expect(result.templateName).toBe('My Template');
    expect(result.secrets).toEqual(createMockSecrets());
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { body: '', secrets: createMockSecrets() });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when encounterId is missing', () => {
    const input = createMockZambdaInput({ templateName: 'My Template' }, { secrets: createMockSecrets() });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when templateName is missing', () => {
    const input = createMockZambdaInput({ encounterId: 'encounter-123' }, { secrets: createMockSecrets() });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when both encounterId and templateName are missing', () => {
    const input = createMockZambdaInput({}, { secrets: createMockSecrets() });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when encounterId is empty string', () => {
    const input = createMockZambdaInput(
      { encounterId: '', templateName: 'My Template' },
      { secrets: createMockSecrets() }
    );
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when templateName is empty string', () => {
    const input = createMockZambdaInput(
      { encounterId: 'encounter-123', templateName: '' },
      { secrets: createMockSecrets() }
    );
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when encounterId is whitespace only', () => {
    const input = createMockZambdaInput(
      { encounterId: '   ', templateName: 'My Template' },
      { secrets: createMockSecrets() }
    );
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when templateName is whitespace only', () => {
    const input = createMockZambdaInput(
      { encounterId: 'encounter-123', templateName: '   ' },
      { secrets: createMockSecrets() }
    );
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when encounterId is not a string', () => {
    const input = createMockZambdaInput(
      { encounterId: 123, templateName: 'My Template' },
      { secrets: createMockSecrets() }
    );
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when templateName is not a string', () => {
    const input = createMockZambdaInput(
      { encounterId: 'encounter-123', templateName: 42 },
      { secrets: createMockSecrets() }
    );
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when secrets are missing', () => {
    const input = createMockZambdaInput(validBody);
    expect(() => validateRequestParameters(input)).toThrow();
  });
});
