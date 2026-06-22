import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/patient/search-places/validateRequestParameters';
import { createMockZambdaInput } from './helpers';

describe('search-places - validateRequestParameters', () => {
  test('should return validated params with searchTerm', () => {
    const input = createMockZambdaInput({ searchTerm: 'CVS Pharmacy' });
    const result = validateRequestParameters(input);

    expect(result.searchTerm).toBe('CVS Pharmacy');
    expect(result.placesId).toBeUndefined();
    expect(result.secrets).toBeNull();
  });

  test('should return validated params with placesId', () => {
    const input = createMockZambdaInput({ placesId: 'ChIJN1t_tDeuEmsR' });
    const result = validateRequestParameters(input);

    expect(result.placesId).toBe('ChIJN1t_tDeuEmsR');
    expect(result.searchTerm).toBeUndefined();
    expect(result.secrets).toBeNull();
  });

  test('should pass locationBias through', () => {
    const input = createMockZambdaInput({
      searchTerm: 'pharmacy',
      locationBias: { latitude: 40.7128, longitude: -74.006 },
    });
    const result = validateRequestParameters(input);
    expect(result.locationBias).toEqual({ latitude: 40.7128, longitude: -74.006 });
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { body: '' });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when neither searchTerm nor placesId is provided', () => {
    const input = createMockZambdaInput({});
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when both searchTerm and placesId are provided', () => {
    const input = createMockZambdaInput({ searchTerm: 'CVS', placesId: 'abc123' });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when searchTerm is not a string', () => {
    const input = createMockZambdaInput({ searchTerm: 123 });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when placesId is not a string', () => {
    const input = createMockZambdaInput({ placesId: 456 });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should pass secrets through from input', () => {
    const secrets = { PROJECT_API: 'https://api.test' };
    const input = createMockZambdaInput({ searchTerm: 'pharmacy' }, { secrets });
    const result = validateRequestParameters(input);
    expect(result.secrets).toEqual(secrets);
  });
});
