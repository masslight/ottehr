import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/rcm/invoice-config/save-invoice-config/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('save-invoice-config - validateRequestParameters', () => {
  const secrets = createMockSecrets();

  test('should return validated params for a valid request', () => {
    const input = createMockZambdaInput(
      {
        dueDaysFromGeneration: 30,
        defaultSmsTemplate: 'Your invoice is due soon.',
        defaultInvoiceMemo: 'Thank you for your payment.',
      },
      { secrets }
    );
    const result = validateRequestParameters(input);

    expect(result).toEqual({
      dueDaysFromGeneration: 30,
      defaultSmsTemplate: 'Your invoice is due soon.',
      defaultInvoiceMemo: 'Thank you for your payment.',
      secrets,
    });
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when secrets are missing', () => {
    const input = createMockZambdaInput(
      { dueDaysFromGeneration: 30, defaultSmsTemplate: 'msg', defaultInvoiceMemo: 'memo' },
      { secrets: null }
    );
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when dueDaysFromGeneration is missing', () => {
    const input = createMockZambdaInput({ defaultSmsTemplate: 'msg', defaultInvoiceMemo: 'memo' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when dueDaysFromGeneration is 0', () => {
    const input = createMockZambdaInput(
      { dueDaysFromGeneration: 0, defaultSmsTemplate: 'msg', defaultInvoiceMemo: 'memo' },
      { secrets }
    );
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when dueDaysFromGeneration is 366 (out of range)', () => {
    const input = createMockZambdaInput(
      { dueDaysFromGeneration: 366, defaultSmsTemplate: 'msg', defaultInvoiceMemo: 'memo' },
      { secrets }
    );
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when dueDaysFromGeneration is not an integer', () => {
    const input = createMockZambdaInput(
      { dueDaysFromGeneration: 30.5, defaultSmsTemplate: 'msg', defaultInvoiceMemo: 'memo' },
      { secrets }
    );
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when defaultSmsTemplate is missing', () => {
    const input = createMockZambdaInput({ dueDaysFromGeneration: 30, defaultInvoiceMemo: 'memo' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when defaultSmsTemplate is empty', () => {
    const input = createMockZambdaInput(
      { dueDaysFromGeneration: 30, defaultSmsTemplate: '', defaultInvoiceMemo: 'memo' },
      { secrets }
    );
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when defaultInvoiceMemo is missing', () => {
    const input = createMockZambdaInput({ dueDaysFromGeneration: 30, defaultSmsTemplate: 'msg' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when defaultInvoiceMemo is empty', () => {
    const input = createMockZambdaInput(
      { dueDaysFromGeneration: 30, defaultSmsTemplate: 'msg', defaultInvoiceMemo: '' },
      { secrets }
    );
    expect(() => validateRequestParameters(input)).toThrow();
  });
});
