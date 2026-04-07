import { ExamType } from 'utils';
import { describe, expect, test } from 'vitest';
import { validateRequestParameters as validateCreateParams } from '../../src/ehr/admin-create-template/validateRequestParameters';
import { validateRequestParameters as validateDeleteParams } from '../../src/ehr/admin-delete-template/validateRequestParameters';
import { validateRequestParameters as validateRenameParams } from '../../src/ehr/admin-rename-template/validateRequestParameters';
import { ZambdaInput } from '../../src/shared';

const createMockZambdaInput = (body: Record<string, unknown>): ZambdaInput => ({
  body: JSON.stringify(body),
  headers: {
    Authorization: 'Bearer test-token',
  },
  secrets: null,
});

const createMockZambdaInputWithSecrets = (body: Record<string, unknown>): ZambdaInput => ({
  body: JSON.stringify(body),
  headers: {
    Authorization: 'Bearer test-token',
  },
  secrets: { AUTH0_SECRET: 'test-secret' },
});

describe('Admin Create Template - validateRequestParameters', () => {
  test('should accept valid input with encounterId, templateName, examType', () => {
    const input = createMockZambdaInputWithSecrets({
      encounterId: 'encounter-123',
      templateName: 'My Template',
      examType: ExamType.IN_PERSON,
    });

    const result = validateCreateParams(input);

    expect(result.encounterId).toBe('encounter-123');
    expect(result.templateName).toBe('My Template');
    expect(result.examType).toBe(ExamType.IN_PERSON);
  });

  test('should accept valid input with telemed examType', () => {
    const input = createMockZambdaInputWithSecrets({
      encounterId: 'encounter-123',
      templateName: 'Telemed Template',
      examType: ExamType.TELEMED,
    });

    const result = validateCreateParams(input);

    expect(result.examType).toBe(ExamType.TELEMED);
  });

  test('should throw when encounterId is missing', () => {
    const input = createMockZambdaInputWithSecrets({
      templateName: 'My Template',
      examType: ExamType.IN_PERSON,
    });

    expect(() => validateCreateParams(input)).toThrow('encounterId');
  });

  test('should throw when templateName is missing', () => {
    const input = createMockZambdaInputWithSecrets({
      encounterId: 'encounter-123',
      examType: ExamType.IN_PERSON,
    });

    expect(() => validateCreateParams(input)).toThrow('templateName');
  });

  test('should throw when templateName is empty string', () => {
    const input = createMockZambdaInputWithSecrets({
      encounterId: 'encounter-123',
      templateName: '',
      examType: ExamType.IN_PERSON,
    });

    expect(() => validateCreateParams(input)).toThrow('templateName');
  });

  test('should throw when examType is missing', () => {
    const input = createMockZambdaInputWithSecrets({
      encounterId: 'encounter-123',
      templateName: 'My Template',
    });

    expect(() => validateCreateParams(input)).toThrow('examType');
  });

  test('should throw when examType is invalid', () => {
    const input = createMockZambdaInputWithSecrets({
      encounterId: 'encounter-123',
      templateName: 'My Template',
      examType: 'invalidType',
    });

    expect(() => validateCreateParams(input)).toThrow('Invalid examType');
  });

  test('should throw when no secrets are provided', () => {
    const input = createMockZambdaInput({
      encounterId: 'encounter-123',
      templateName: 'My Template',
      examType: ExamType.IN_PERSON,
    });

    expect(() => validateCreateParams(input)).toThrow('No secrets provided');
  });
});

describe('Admin Rename Template - validateRequestParameters', () => {
  test('should accept valid input with templateId and newName', () => {
    const input = createMockZambdaInputWithSecrets({
      templateId: 'template-456',
      newName: 'Renamed Template',
    });

    const result = validateRenameParams(input);

    expect(result.templateId).toBe('template-456');
    expect(result.newName).toBe('Renamed Template');
  });

  test('should throw when templateId is missing', () => {
    const input = createMockZambdaInputWithSecrets({
      newName: 'Renamed Template',
    });

    expect(() => validateRenameParams(input)).toThrow('templateId');
  });

  test('should throw when newName is missing', () => {
    const input = createMockZambdaInputWithSecrets({
      templateId: 'template-456',
    });

    expect(() => validateRenameParams(input)).toThrow('newName');
  });

  test('should throw when newName is empty string', () => {
    const input = createMockZambdaInputWithSecrets({
      templateId: 'template-456',
      newName: '',
    });

    expect(() => validateRenameParams(input)).toThrow('newName');
  });

  test('should throw when templateId is empty string', () => {
    const input = createMockZambdaInputWithSecrets({
      templateId: '',
      newName: 'Renamed Template',
    });

    expect(() => validateRenameParams(input)).toThrow('templateId');
  });

  test('should throw when no secrets are provided', () => {
    const input = createMockZambdaInput({
      templateId: 'template-456',
      newName: 'Renamed Template',
    });

    expect(() => validateRenameParams(input)).toThrow('No secrets provided');
  });
});

describe('Admin Delete Template - validateRequestParameters', () => {
  test('should accept valid input with templateId', () => {
    const input = createMockZambdaInputWithSecrets({
      templateId: 'template-789',
    });

    const result = validateDeleteParams(input);

    expect(result.templateId).toBe('template-789');
  });

  test('should throw when templateId is missing', () => {
    const input = createMockZambdaInputWithSecrets({});

    expect(() => validateDeleteParams(input)).toThrow('templateId');
  });

  test('should throw when templateId is empty string', () => {
    const input = createMockZambdaInputWithSecrets({
      templateId: '',
    });

    expect(() => validateDeleteParams(input)).toThrow('templateId');
  });

  test('should throw when no secrets are provided', () => {
    const input = createMockZambdaInput({
      templateId: 'template-789',
    });

    expect(() => validateDeleteParams(input)).toThrow('No secrets provided');
  });

  test('should throw when body is missing', () => {
    const input: ZambdaInput = {
      body: null,
      headers: {
        Authorization: 'Bearer test-token',
      },
      secrets: { AUTH0_SECRET: 'test-secret' },
    };

    expect(() => validateDeleteParams(input)).toThrow('No request body provided');
  });
});
