import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/ehr/get-medication-orders/validateRequestParameters';
import { createMockZambdaInput } from './helpers';

describe('get-medication-orders - validateRequestParameters', () => {
  test('should return validated params with encounterId search', () => {
    const input = createMockZambdaInput({
      searchBy: { field: 'encounterId', value: 'enc-123' },
    });
    const result = validateRequestParameters(input);

    expect(result.searchBy).toEqual({ field: 'encounterId', value: 'enc-123' });
    expect(result.secrets).toBeNull();
  });

  test('should return validated params with encounterIds search', () => {
    const input = createMockZambdaInput({
      searchBy: { field: 'encounterIds', value: ['enc-1', 'enc-2'] },
    });
    const result = validateRequestParameters(input);

    expect(result.searchBy).toEqual({ field: 'encounterIds', value: ['enc-1', 'enc-2'] });
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { body: '' });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when searchBy is missing', () => {
    const input = createMockZambdaInput({});
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when searchBy.field is invalid', () => {
    const input = createMockZambdaInput({
      searchBy: { field: 'invalidField', value: 'abc' },
    });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when searchBy.value is missing', () => {
    const input = createMockZambdaInput({
      searchBy: { field: 'encounterId' },
    });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when encounterIds value is not an array', () => {
    const input = createMockZambdaInput({
      searchBy: { field: 'encounterIds', value: 'not-an-array' },
    });
    expect(() => validateRequestParameters(input)).toThrow();
  });
});
