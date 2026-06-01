import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/ehr/export-invoices/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('export-invoices - validateRequestParameters', () => {
  const secrets = createMockSecrets();

  describe('kick-off request (no taskId)', () => {
    test('should return validated params for a basic kick-off request', () => {
      const input = createMockZambdaInput({}, { secrets });
      const result = validateRequestParameters(input);

      expect(result).toEqual({
        secrets,
      });
    });

    test('should accept optional status field', () => {
      const input = createMockZambdaInput({ status: 'ready' }, { secrets });
      const result = validateRequestParameters(input);

      expect(result).toEqual({
        status: 'ready',
        secrets,
      });
    });

    test('should accept optional sortField and sortDirection', () => {
      const input = createMockZambdaInput({ sortField: 'finalizationDate', sortDirection: 'asc' }, { secrets });
      const result = validateRequestParameters(input);

      expect(result).toEqual({
        sortField: 'finalizationDate',
        sortDirection: 'asc',
        secrets,
      });
    });

    test('should accept optional hideZeroBalance', () => {
      const input = createMockZambdaInput({ hideZeroBalance: true }, { secrets });
      const result = validateRequestParameters(input);

      expect(result).toEqual({
        hideZeroBalance: true,
        secrets,
      });
    });

    test('should reject invalid status value', () => {
      const input = createMockZambdaInput({ status: 'invalid-status' }, { secrets });
      expect(() => validateRequestParameters(input)).toThrow();
    });

    test('should reject invalid sortField value', () => {
      const input = createMockZambdaInput({ sortField: 'invalid' }, { secrets });
      expect(() => validateRequestParameters(input)).toThrow();
    });

    test('should reject invalid sortDirection value', () => {
      const input = createMockZambdaInput({ sortDirection: 'invalid' }, { secrets });
      expect(() => validateRequestParameters(input)).toThrow();
    });
  });

  describe('status check request (with taskId)', () => {
    test('should return validated params for a status check request', () => {
      const input = createMockZambdaInput({ taskId: 'some-task-id' }, { secrets });
      const result = validateRequestParameters(input);

      expect(result).toEqual({
        taskId: 'some-task-id',
        secrets,
      });
    });
  });

  describe('error cases', () => {
    test('should throw when body is missing', () => {
      const input = createMockZambdaInput(null, { secrets });
      expect(() => validateRequestParameters(input)).toThrow();
    });

    test('should throw when secrets are missing', () => {
      const input = createMockZambdaInput({}, { secrets: null });
      expect(() => validateRequestParameters(input)).toThrow();
    });
  });
});
