import { GetMedicationOrdersInputSchema } from 'utils/lib/types/api/medication-administration.types';
import { describe, expect, test } from 'vitest';
import { validateWithSchema } from '../../../src/shared/validation';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('get-medication-orders - validateRequestParameters', () => {
  const secrets = createMockSecrets();

  test('should return validated params with encounterId search', () => {
    const input = createMockZambdaInput(
      {
        searchBy: { field: 'encounterId', value: '550e8400-e29b-41d4-a716-446655440000' },
      },
      { secrets }
    );
    const result = validateWithSchema(GetMedicationOrdersInputSchema, input);

    expect(result.searchBy).toEqual({ field: 'encounterId', value: '550e8400-e29b-41d4-a716-446655440000' });
    expect(result.secrets).toEqual(secrets);
  });

  test('should return validated params with encounterIds search', () => {
    const input = createMockZambdaInput(
      {
        searchBy: {
          field: 'encounterIds',
          value: ['550e8400-e29b-41d4-a716-446655440000', '6ba7b810-9dad-11d1-80b4-00c04fd430c8'],
        },
      },
      { secrets }
    );
    const result = validateWithSchema(GetMedicationOrdersInputSchema, input);

    expect(result.searchBy).toEqual({
      field: 'encounterIds',
      value: ['550e8400-e29b-41d4-a716-446655440000', '6ba7b810-9dad-11d1-80b4-00c04fd430c8'],
    });
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { body: '', secrets });
    expect(() => validateWithSchema(GetMedicationOrdersInputSchema, input)).toThrow();
  });

  test('should throw when searchBy is missing', () => {
    const input = createMockZambdaInput({}, { secrets });
    expect(() => validateWithSchema(GetMedicationOrdersInputSchema, input)).toThrow();
  });

  test('should throw when searchBy.field is invalid', () => {
    const input = createMockZambdaInput(
      {
        searchBy: { field: 'invalidField', value: 'abc' },
      },
      { secrets }
    );
    expect(() => validateWithSchema(GetMedicationOrdersInputSchema, input)).toThrow();
  });

  test('should throw when searchBy.value is missing', () => {
    const input = createMockZambdaInput(
      {
        searchBy: { field: 'encounterId' },
      },
      { secrets }
    );
    expect(() => validateWithSchema(GetMedicationOrdersInputSchema, input)).toThrow();
  });

  test('should throw when encounterIds value is not an array', () => {
    const input = createMockZambdaInput(
      {
        searchBy: { field: 'encounterIds', value: 'not-an-array' },
      },
      { secrets }
    );
    expect(() => validateWithSchema(GetMedicationOrdersInputSchema, input)).toThrow();
  });

  test('should throw when encounterId value is not a valid UUID', () => {
    const input = createMockZambdaInput(
      {
        searchBy: { field: 'encounterId', value: 'enc-123' },
      },
      { secrets }
    );
    expect(() => validateWithSchema(GetMedicationOrdersInputSchema, input)).toThrow();
  });

  test('should throw when encounterIds array contains non-UUID values', () => {
    const input = createMockZambdaInput(
      {
        searchBy: { field: 'encounterIds', value: ['enc-1', 'enc-2'] },
      },
      { secrets }
    );
    expect(() => validateWithSchema(GetMedicationOrdersInputSchema, input)).toThrow();
  });
});
