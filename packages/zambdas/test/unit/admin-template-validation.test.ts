import { describe, expect, test } from 'vitest';
import { AdminCreateTemplateSchema } from '../../src/ehr/admin-create-template/index';
import { AdminDeleteTemplateSchema } from '../../src/ehr/admin-delete-template/index';
import { AdminRenameTemplateSchema } from '../../src/ehr/admin-rename-template/index';
import { ZambdaInput } from '../../src/shared/types/common';
import { validateWithSchema } from '../../src/shared/validation';

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
  const UUID_1 = '550e8400-e29b-41d4-a716-446655440000';

  test('should accept valid input with encounterId, templateName', () => {
    const input = createMockZambdaInputWithSecrets({
      encounterId: UUID_1,
      templateName: 'My Template',
    });

    const result = validateWithSchema(AdminCreateTemplateSchema, input);

    expect(result.encounterId).toBe(UUID_1);
    expect(result.templateName).toBe('My Template');
  });

  test('should throw when encounterId is missing', () => {
    const input = createMockZambdaInputWithSecrets({
      templateName: 'My Template',
    });

    expect(() => validateWithSchema(AdminCreateTemplateSchema, input)).toThrow('encounterId');
  });

  test('should throw when templateName is missing', () => {
    const input = createMockZambdaInputWithSecrets({
      encounterId: UUID_1,
    });

    expect(() => validateWithSchema(AdminCreateTemplateSchema, input)).toThrow('templateName');
  });

  test('should throw when templateName is empty string', () => {
    const input = createMockZambdaInputWithSecrets({
      encounterId: UUID_1,
      templateName: '',
    });

    expect(() => validateWithSchema(AdminCreateTemplateSchema, input)).toThrow('templateName');
  });

  test('should throw when encounterId is not a valid UUID', () => {
    const input = createMockZambdaInputWithSecrets({
      encounterId: 'encounter-123',
      templateName: 'My Template',
    });

    expect(() => validateWithSchema(AdminCreateTemplateSchema, input)).toThrow();
  });

  test('should throw when no secrets are provided', () => {
    const input = createMockZambdaInput({
      encounterId: UUID_1,
      templateName: 'My Template',
    });

    expect(() => validateWithSchema(AdminCreateTemplateSchema, input)).toThrow();
  });
});

describe('Admin Rename Template - validateRequestParameters', () => {
  const UUID_2 = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

  test('should accept valid input with templateId and newName', () => {
    const input = createMockZambdaInputWithSecrets({
      templateId: UUID_2,
      newName: 'Renamed Template',
    });

    const result = validateWithSchema(AdminRenameTemplateSchema, input);

    expect(result.templateId).toBe(UUID_2);
    expect(result.newName).toBe('Renamed Template');
  });

  test('should throw when templateId is missing', () => {
    const input = createMockZambdaInputWithSecrets({
      newName: 'Renamed Template',
    });

    expect(() => validateWithSchema(AdminRenameTemplateSchema, input)).toThrow('templateId');
  });

  test('should throw when newName is missing', () => {
    const input = createMockZambdaInputWithSecrets({
      templateId: UUID_2,
    });

    expect(() => validateWithSchema(AdminRenameTemplateSchema, input)).toThrow('newName');
  });

  test('should throw when newName is empty string', () => {
    const input = createMockZambdaInputWithSecrets({
      templateId: UUID_2,
      newName: '',
    });

    expect(() => validateWithSchema(AdminRenameTemplateSchema, input)).toThrow('newName');
  });

  test('should throw when templateId is empty string', () => {
    const input = createMockZambdaInputWithSecrets({
      templateId: '',
      newName: 'Renamed Template',
    });

    expect(() => validateWithSchema(AdminRenameTemplateSchema, input)).toThrow('templateId');
  });

  test('should throw when templateId is not a valid UUID', () => {
    const input = createMockZambdaInputWithSecrets({
      templateId: 'template-456',
      newName: 'Renamed Template',
    });

    expect(() => validateWithSchema(AdminRenameTemplateSchema, input)).toThrow();
  });

  test('should throw when no secrets are provided', () => {
    const input = createMockZambdaInput({
      templateId: UUID_2,
      newName: 'Renamed Template',
    });

    expect(() => validateWithSchema(AdminRenameTemplateSchema, input)).toThrow();
  });
});

describe('Admin Delete Template - validateRequestParameters', () => {
  const UUID_2 = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

  test('should accept valid input with templateId', () => {
    const input = createMockZambdaInputWithSecrets({
      templateId: UUID_2,
    });

    const result = validateWithSchema(AdminDeleteTemplateSchema, input);

    expect(result.templateId).toBe(UUID_2);
  });

  test('should throw when templateId is missing', () => {
    const input = createMockZambdaInputWithSecrets({});

    expect(() => validateWithSchema(AdminDeleteTemplateSchema, input)).toThrow('templateId');
  });

  test('should throw when templateId is empty string', () => {
    const input = createMockZambdaInputWithSecrets({
      templateId: '',
    });

    expect(() => validateWithSchema(AdminDeleteTemplateSchema, input)).toThrow('templateId');
  });

  test('should throw when templateId is not a valid UUID', () => {
    const input = createMockZambdaInputWithSecrets({
      templateId: 'template-789',
    });

    expect(() => validateWithSchema(AdminDeleteTemplateSchema, input)).toThrow();
  });

  test('should throw when no secrets are provided', () => {
    const input = createMockZambdaInput({
      templateId: UUID_2,
    });

    expect(() => validateWithSchema(AdminDeleteTemplateSchema, input)).toThrow();
  });

  test('should throw when body is missing', () => {
    const input: ZambdaInput = {
      body: null,
      headers: {
        Authorization: 'Bearer test-token',
      },
      secrets: { AUTH0_SECRET: 'test-secret' },
    };

    expect(() => validateWithSchema(AdminDeleteTemplateSchema, input)).toThrow();
  });
});
