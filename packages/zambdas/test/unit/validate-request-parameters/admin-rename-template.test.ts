import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/ehr/admin-rename-template/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('admin-rename-template - validateRequestParameters', () => {
  const validBody = {
    templateId: 'template-abc',
    newName: 'Renamed Template',
  };

  test('should return validated params with all required fields', () => {
    const input = createMockZambdaInput(validBody, { secrets: createMockSecrets() });
    const result = validateRequestParameters(input);

    expect(result.templateId).toBe('template-abc');
    expect(result.newName).toBe('Renamed Template');
    expect(result.secrets).toEqual(createMockSecrets());
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { body: '', secrets: createMockSecrets() });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when templateId is missing', () => {
    const input = createMockZambdaInput({ newName: 'Renamed Template' }, { secrets: createMockSecrets() });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when newName is missing', () => {
    const input = createMockZambdaInput({ templateId: 'template-abc' }, { secrets: createMockSecrets() });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when both templateId and newName are missing', () => {
    const input = createMockZambdaInput({}, { secrets: createMockSecrets() });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when templateId is empty string', () => {
    const input = createMockZambdaInput(
      { templateId: '', newName: 'Renamed Template' },
      { secrets: createMockSecrets() }
    );
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when newName is empty string', () => {
    const input = createMockZambdaInput({ templateId: 'template-abc', newName: '' }, { secrets: createMockSecrets() });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when templateId is whitespace only', () => {
    const input = createMockZambdaInput(
      { templateId: '   ', newName: 'Renamed Template' },
      { secrets: createMockSecrets() }
    );
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when newName is whitespace only', () => {
    const input = createMockZambdaInput(
      { templateId: 'template-abc', newName: '   ' },
      { secrets: createMockSecrets() }
    );
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when templateId is not a string', () => {
    const input = createMockZambdaInput(
      { templateId: 123, newName: 'Renamed Template' },
      { secrets: createMockSecrets() }
    );
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when newName is not a string', () => {
    const input = createMockZambdaInput({ templateId: 'template-abc', newName: 42 }, { secrets: createMockSecrets() });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when secrets are missing', () => {
    const input = createMockZambdaInput(validBody);
    expect(() => validateRequestParameters(input)).toThrow();
  });
});
