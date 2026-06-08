import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/ehr/get-medication-orders/validateRequestParameters';
import { createMockZambdaInput } from './helpers';

describe('get-medication-orders - validateRequestParameters', () => {
  test('should return validated params with encounterId search', () => {
    const input = createMockZambdaInput({
      searchBy: { field: 'encounterId', value: '550e8400-e29b-41d4-a716-446655440000' },
    });
    const result = validateRequestParameters(input);

    expect(result.searchBy).toEqual({ field: 'encounterId', value: '550e8400-e29b-41d4-a716-446655440000' });
    expect(result.secrets).toBeNull();
  });

  test('should return validated params with encounterIds search', () => {
    const input = createMockZambdaInput({
      searchBy: {
        field: 'encounterIds',
        value: ['550e8400-e29b-41d4-a716-446655440000', '6ba7b810-9dad-11d1-80b4-00c04fd430c8'],
      },
    });
    const result = validateRequestParameters(input);

    expect(result.searchBy).toEqual({
      field: 'encounterIds',
      value: ['550e8400-e29b-41d4-a716-446655440000', '6ba7b810-9dad-11d1-80b4-00c04fd430c8'],
    });
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

  test('should throw when encounterId value is not a valid UUID', () => {
    const input = createMockZambdaInput({
      searchBy: { field: 'encounterId', value: 'enc-123' },
    });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when encounterIds array contains non-UUID values', () => {
    const input = createMockZambdaInput({
      searchBy: { field: 'encounterIds', value: ['enc-1', 'enc-2'] },
    });
    expect(() => validateRequestParameters(input)).toThrow();
  });
});
