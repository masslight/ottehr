import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/rcm/fee-schedules/create-fee-schedule/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('create-fee-schedule - validateRequestParameters', () => {
  const secrets = createMockSecrets();

  test('should return validated params for a valid request', () => {
    const input = createMockZambdaInput(
      { name: 'Medicare Fee Schedule', effectiveDate: '2025-01-01', description: 'Standard Medicare rates' },
      { secrets }
    );
    const result = validateRequestParameters(input);

    expect(result).toEqual({
      name: 'Medicare Fee Schedule',
      effectiveDate: '2025-01-01',
      description: 'Standard Medicare rates',
      secrets,
    });
  });

  test('should default description to empty string when not provided', () => {
    const input = createMockZambdaInput({ name: 'Medicare Fee Schedule', effectiveDate: '2025-01-01' }, { secrets });
    const result = validateRequestParameters(input);

    expect(result.description).toBe('');
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when name is missing', () => {
    const input = createMockZambdaInput({ effectiveDate: '2025-01-01' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when effectiveDate is missing', () => {
    const input = createMockZambdaInput({ name: 'Medicare Fee Schedule' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when both name and effectiveDate are missing', () => {
    const input = createMockZambdaInput({}, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when name is an empty string', () => {
    const input = createMockZambdaInput({ name: '', effectiveDate: '2025-01-01' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when effectiveDate is an empty string', () => {
    const input = createMockZambdaInput({ name: 'Medicare Fee Schedule', effectiveDate: '' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });
});
