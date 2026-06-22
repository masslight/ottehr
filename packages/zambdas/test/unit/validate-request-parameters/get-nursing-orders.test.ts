import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/ehr/get-nursing-orders/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('get-nursing-orders - validateRequestParameters', () => {
  const secrets = createMockSecrets();

  const validBody = {
    searchBy: {
      field: 'encounterId',
      value: 'enc-123',
    },
  };

  test('should return validated params with encounterId search', () => {
    const input = createMockZambdaInput(validBody, { secrets });
    const result = validateRequestParameters(input);

    expect(result.searchBy).toEqual({ field: 'encounterId', value: 'enc-123' });
    expect(result.secrets).toBe(secrets);
  });

  test('should return validated params with encounterIds search', () => {
    const input = createMockZambdaInput(
      { searchBy: { field: 'encounterIds', value: ['enc-1', 'enc-2'] } },
      { secrets }
    );
    const result = validateRequestParameters(input);

    expect(result.searchBy).toEqual({ field: 'encounterIds', value: ['enc-1', 'enc-2'] });
  });

  test('should return validated params with serviceRequestId search', () => {
    const input = createMockZambdaInput({ searchBy: { field: 'serviceRequestId', value: 'sr-123' } }, { secrets });
    const result = validateRequestParameters(input);

    expect(result.searchBy).toEqual({ field: 'serviceRequestId', value: 'sr-123' });
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { body: '', secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when searchBy is missing', () => {
    const input = createMockZambdaInput({}, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when searchBy has invalid field', () => {
    const input = createMockZambdaInput({ searchBy: { field: 'invalidField', value: 'test' } }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });
});
