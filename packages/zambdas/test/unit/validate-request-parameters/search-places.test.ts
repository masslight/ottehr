import { describe, expect, test } from 'vitest';
import { bodySchema } from '../../../src/patient/search-places/index';
import { validateWithSchema } from '../../../src/shared/validation';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('search-places - validateRequestParameters', () => {
  const secrets = createMockSecrets();

  test('should return validated params with searchTerm', () => {
    const input = createMockZambdaInput({ searchTerm: 'CVS Pharmacy' }, { secrets });
    const result = validateWithSchema(bodySchema, input);

    expect(result.searchTerm).toBe('CVS Pharmacy');
    expect(result.placesId).toBeUndefined();
    expect(result.secrets).toEqual(secrets);
  });

  test('should return validated params with placesId', () => {
    const input = createMockZambdaInput({ placesId: 'ChIJN1t_tDeuEmsR' }, { secrets });
    const result = validateWithSchema(bodySchema, input);

    expect(result.placesId).toBe('ChIJN1t_tDeuEmsR');
    expect(result.searchTerm).toBeUndefined();
    expect(result.secrets).toEqual(secrets);
  });

  test('should pass locationBias through', () => {
    const input = createMockZambdaInput(
      {
        searchTerm: 'pharmacy',
        locationBias: { latitude: 40.7128, longitude: -74.006 },
      },
      { secrets }
    );
    const result = validateWithSchema(bodySchema, input);
    expect(result.locationBias).toEqual({ latitude: 40.7128, longitude: -74.006 });
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { body: '', secrets });
    expect(() => validateWithSchema(bodySchema, input)).toThrow();
  });

  test('should throw when neither searchTerm nor placesId is provided', () => {
    const input = createMockZambdaInput({}, { secrets });
    expect(() => validateWithSchema(bodySchema, input)).toThrow();
  });

  test('should throw when both searchTerm and placesId are provided', () => {
    const input = createMockZambdaInput({ searchTerm: 'CVS', placesId: 'abc123' }, { secrets });
    expect(() => validateWithSchema(bodySchema, input)).toThrow();
  });

  test('should throw when searchTerm is not a string', () => {
    const input = createMockZambdaInput({ searchTerm: 123 }, { secrets });
    expect(() => validateWithSchema(bodySchema, input)).toThrow();
  });

  test('should throw when placesId is not a string', () => {
    const input = createMockZambdaInput({ placesId: 456 }, { secrets });
    expect(() => validateWithSchema(bodySchema, input)).toThrow();
  });

  test('should pass secrets through from input', () => {
    const secrets = { PROJECT_API: 'https://api.test' };
    const input = createMockZambdaInput({ searchTerm: 'pharmacy' }, { secrets });
    const result = validateWithSchema(bodySchema, input);
    expect(result.secrets).toEqual(secrets);
  });
});
