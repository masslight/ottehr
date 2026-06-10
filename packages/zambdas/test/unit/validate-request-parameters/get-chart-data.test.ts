import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/ehr/get-chart-data/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('get-chart-data - validateRequestParameters', () => {
  const secrets = createMockSecrets();

  const validBody = {
    encounterId: '550e8400-e29b-41d4-a716-446655440000',
  };

  test('should return validated params when all required fields provided', () => {
    const input = createMockZambdaInput(validBody, { secrets });
    const result = validateRequestParameters(input);

    expect(result.encounterId).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(result.secrets).toBe(secrets);
  });

  test('should accept optional requestedFields', () => {
    const input = createMockZambdaInput({ ...validBody, requestedFields: { medications: {} } }, { secrets });
    const result = validateRequestParameters(input);

    expect(result.requestedFields).toEqual({ medications: {} });
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { body: '', secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when encounterId is missing', () => {
    const input = createMockZambdaInput({}, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when encounterId is not a valid UUID', () => {
    const input = createMockZambdaInput({ encounterId: 'not-a-uuid' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when encounterId is empty string', () => {
    const input = createMockZambdaInput({ encounterId: '' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when encounterId is not a string', () => {
    const input = createMockZambdaInput({ encounterId: 123 }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });
});
