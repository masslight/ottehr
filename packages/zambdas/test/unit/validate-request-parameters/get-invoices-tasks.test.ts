import { GetInvoicesTasksZambdaInputSchema } from 'utils/lib/types/api/invoicing.types';
import { describe, expect, test } from 'vitest';
import { validateWithSchema } from '../../../src/shared/validation';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('get-invoices-tasks - validateRequestParameters', () => {
  test('should return validated params with all fields', () => {
    const secrets = createMockSecrets();
    const input = createMockZambdaInput(
      {
        page: 0,
        status: 'ready',
        patientId: 'patient-123',
        sortField: 'finalizationDate',
        sortDirection: 'asc',
        hideZeroBalance: true,
      },
      { secrets }
    );
    const result = validateWithSchema(GetInvoicesTasksZambdaInputSchema, input);

    expect(result.page).toBe(0);
    expect(result.status).toBe('ready');
    expect(result.patientId).toBe('patient-123');
    expect(result.sortField).toBe('finalizationDate');
    expect(result.sortDirection).toBe('asc');
    expect(result.hideZeroBalance).toBe(true);
    expect(result.secrets).toEqual(secrets);
  });

  test('should return validated params with no optional fields', () => {
    const secrets = createMockSecrets();
    const input = createMockZambdaInput({}, { secrets });
    const result = validateWithSchema(GetInvoicesTasksZambdaInputSchema, input);

    expect(result.secrets).toEqual(secrets);
    expect(result.page).toBeUndefined();
    expect(result.status).toBeUndefined();
  });

  test('should throw when body is missing', () => {
    const secrets = createMockSecrets();
    const input = createMockZambdaInput(null, { body: null as any, secrets });
    expect(() => validateWithSchema(GetInvoicesTasksZambdaInputSchema, input)).toThrow();
  });

  test('should throw when secrets are missing', () => {
    const input = createMockZambdaInput({}, { secrets: null });
    expect(() => validateWithSchema(GetInvoicesTasksZambdaInputSchema, input)).toThrow();
  });

  test('should throw when status is invalid', () => {
    const secrets = createMockSecrets();
    const input = createMockZambdaInput({ status: 'invalid-status' }, { secrets });
    expect(() => validateWithSchema(GetInvoicesTasksZambdaInputSchema, input)).toThrow();
  });

  test('should throw when sortField is invalid', () => {
    const secrets = createMockSecrets();
    const input = createMockZambdaInput({ sortField: 'badField' }, { secrets });
    expect(() => validateWithSchema(GetInvoicesTasksZambdaInputSchema, input)).toThrow();
  });

  test('should throw when sortDirection is invalid', () => {
    const secrets = createMockSecrets();
    const input = createMockZambdaInput({ sortDirection: 'up' }, { secrets });
    expect(() => validateWithSchema(GetInvoicesTasksZambdaInputSchema, input)).toThrow();
  });

  test('should throw when page is negative', () => {
    const secrets = createMockSecrets();
    const input = createMockZambdaInput({ page: -1 }, { secrets });
    expect(() => validateWithSchema(GetInvoicesTasksZambdaInputSchema, input)).toThrow();
  });

  test('should accept appointmentDate as sortField', () => {
    const secrets = createMockSecrets();
    const input = createMockZambdaInput({ sortField: 'appointmentDate' }, { secrets });
    const result = validateWithSchema(GetInvoicesTasksZambdaInputSchema, input);

    expect(result.sortField).toBe('appointmentDate');
  });
});
