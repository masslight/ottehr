import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/ehr/apply-template/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('apply-template - validateRequestParameters', () => {
  const validBody = {
    templateName: 'My Template',
    encounterId: 'encounter-123',
  };

  test('should return validated params with required fields only', () => {
    const input = createMockZambdaInput(validBody, { secrets: createMockSecrets() });
    const result = validateRequestParameters(input);

    expect(result.templateName).toBe('My Template');
    expect(result.encounterId).toBe('encounter-123');
    expect(result.sectionActions).toEqual({});
    expect(result.secrets).toEqual(createMockSecrets());
  });

  test('should return validated params with sectionActions', () => {
    const body = {
      ...validBody,
      sectionActions: { hpi: 'overwrite', mdm: 'skip' },
    };
    const input = createMockZambdaInput(body, { secrets: createMockSecrets() });
    const result = validateRequestParameters(input);

    expect(result.sectionActions).toEqual({ hpi: 'overwrite', mdm: 'skip' });
  });

  test('should accept append for sections that support it', () => {
    const body = {
      ...validBody,
      sectionActions: { hpi: 'append', diagnoses: 'append' },
    };
    const input = createMockZambdaInput(body, { secrets: createMockSecrets() });
    const result = validateRequestParameters(input);

    expect(result.sectionActions).toEqual({ hpi: 'append', diagnoses: 'append' });
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { body: '', secrets: createMockSecrets() });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when templateName is missing', () => {
    const input = createMockZambdaInput({ encounterId: 'encounter-123' }, { secrets: createMockSecrets() });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when encounterId is missing', () => {
    const input = createMockZambdaInput({ templateName: 'My Template' }, { secrets: createMockSecrets() });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when both templateName and encounterId are missing', () => {
    const input = createMockZambdaInput({}, { secrets: createMockSecrets() });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when templateName is empty string', () => {
    const input = createMockZambdaInput(
      { templateName: '', encounterId: 'encounter-123' },
      { secrets: createMockSecrets() }
    );
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when encounterId is empty string', () => {
    const input = createMockZambdaInput(
      { templateName: 'My Template', encounterId: '' },
      { secrets: createMockSecrets() }
    );
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when templateName is whitespace only', () => {
    const input = createMockZambdaInput(
      { templateName: '   ', encounterId: 'encounter-123' },
      { secrets: createMockSecrets() }
    );
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when encounterId is whitespace only', () => {
    const input = createMockZambdaInput(
      { templateName: 'My Template', encounterId: '   ' },
      { secrets: createMockSecrets() }
    );
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when templateName is not a string', () => {
    const input = createMockZambdaInput(
      { templateName: 123, encounterId: 'encounter-123' },
      { secrets: createMockSecrets() }
    );
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when encounterId is not a string', () => {
    const input = createMockZambdaInput(
      { templateName: 'My Template', encounterId: 123 },
      { secrets: createMockSecrets() }
    );
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when sectionActions contains an unknown section key', () => {
    const body = {
      ...validBody,
      sectionActions: { unknownSection: 'overwrite' },
    };
    const input = createMockZambdaInput(body, { secrets: createMockSecrets() });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when sectionActions contains an invalid action value', () => {
    const body = {
      ...validBody,
      sectionActions: { hpi: 'invalidAction' },
    };
    const input = createMockZambdaInput(body, { secrets: createMockSecrets() });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when append is used on a section that does not support it (examFindings)', () => {
    const body = {
      ...validBody,
      sectionActions: { examFindings: 'append' },
    };
    const input = createMockZambdaInput(body, { secrets: createMockSecrets() });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when append is used on a section that does not support it (emCode)', () => {
    const body = {
      ...validBody,
      sectionActions: { emCode: 'append' },
    };
    const input = createMockZambdaInput(body, { secrets: createMockSecrets() });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when sectionActions is not an object', () => {
    const body = {
      ...validBody,
      sectionActions: 'not-an-object',
    };
    const input = createMockZambdaInput(body, { secrets: createMockSecrets() });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when sectionActions is an array', () => {
    const body = {
      ...validBody,
      sectionActions: ['hpi'],
    };
    const input = createMockZambdaInput(body, { secrets: createMockSecrets() });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when secrets are missing', () => {
    const input = createMockZambdaInput(validBody);
    expect(() => validateRequestParameters(input)).toThrow();
  });
});
