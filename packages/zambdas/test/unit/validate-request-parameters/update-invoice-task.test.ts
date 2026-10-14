import { randomUUID } from 'crypto';
import { UpdateInvoiceTaskZambdaInputSchema } from 'utils/lib/types/api/invoicing.types';
import { describe, expect, test } from 'vitest';
import { validateWithSchema } from '../../../src/shared/validation';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('update-invoice-task - validateRequestParameters', () => {
  const validTaskId = randomUUID();

  test('should return validated params with required fields', () => {
    const secrets = createMockSecrets();
    const input = createMockZambdaInput({ taskId: validTaskId, status: 'ready' }, { secrets });
    const result = validateWithSchema(UpdateInvoiceTaskZambdaInputSchema, input);

    expect(result.taskId).toBe(validTaskId);
    expect(result.status).toBe('ready');
    expect(result.secrets).toEqual(secrets);
  });

  test('should return validated params with optional invoiceTaskInput', () => {
    const secrets = createMockSecrets();
    const input = createMockZambdaInput(
      {
        taskId: validTaskId,
        status: 'ready',
        invoiceTaskInput: {
          dueDate: '2024-12-31',
          memo: 'Test memo',
          amountCents: 5000,
        },
      },
      { secrets }
    );
    const result = validateWithSchema(UpdateInvoiceTaskZambdaInputSchema, input);

    expect(result.invoiceTaskInput).toBeDefined();
    expect(result.invoiceTaskInput?.dueDate).toBe('2024-12-31');
    expect(result.invoiceTaskInput?.memo).toBe('Test memo');
  });

  test('should throw when body is missing', () => {
    const secrets = createMockSecrets();
    const input = createMockZambdaInput(null, { body: null as any, secrets });
    expect(() => validateWithSchema(UpdateInvoiceTaskZambdaInputSchema, input)).toThrow();
  });

  test('should throw when secrets are missing', () => {
    const input = createMockZambdaInput({ taskId: validTaskId, status: 'ready' }, { secrets: null });
    expect(() => validateWithSchema(UpdateInvoiceTaskZambdaInputSchema, input)).toThrow();
  });

  test('should throw when taskId is missing', () => {
    const secrets = createMockSecrets();
    const input = createMockZambdaInput({ status: 'ready' }, { secrets });
    expect(() => validateWithSchema(UpdateInvoiceTaskZambdaInputSchema, input)).toThrow();
  });

  test('should throw when taskId is not a valid UUID', () => {
    const secrets = createMockSecrets();
    const input = createMockZambdaInput({ taskId: 'not-a-uuid', status: 'ready' }, { secrets });
    expect(() => validateWithSchema(UpdateInvoiceTaskZambdaInputSchema, input)).toThrow();
  });

  test('should throw when status is missing', () => {
    const secrets = createMockSecrets();
    const input = createMockZambdaInput({ taskId: validTaskId }, { secrets });
    expect(() => validateWithSchema(UpdateInvoiceTaskZambdaInputSchema, input)).toThrow();
  });

  test('should accept without invoiceTaskInput', () => {
    const secrets = createMockSecrets();
    const input = createMockZambdaInput({ taskId: validTaskId, status: 'completed' }, { secrets });
    const result = validateWithSchema(UpdateInvoiceTaskZambdaInputSchema, input);

    expect(result.invoiceTaskInput).toBeUndefined();
  });
});
