import { describe, expect, test } from 'vitest';
import { SCHEDULE_TYPES, validateRequestParameters } from '../../../src/patient/get-schedule/validateRequestParameters';
import { createMockZambdaInput } from './helpers';

describe('get-schedule - validateRequestParameters', () => {
  const validBody = {
    slug: 'my-location',
    scheduleType: 'location',
    selectedDate: '2024-01-15',
  };

  test('should return validated params with required fields', () => {
    const input = createMockZambdaInput(validBody);
    const result = validateRequestParameters(input);

    expect(result.slug).toBe('my-location');
    expect(result.scheduleType).toBe('location');
    expect(result.selectedDate).toBe('2024-01-15');
    expect(result.secrets).toBeNull();
  });

  test('should accept scheduleType "provider"', () => {
    const input = createMockZambdaInput({ ...validBody, scheduleType: 'provider' });
    const result = validateRequestParameters(input);
    expect(result.scheduleType).toBe('provider');
  });

  test('should accept scheduleType "group"', () => {
    const input = createMockZambdaInput({ ...validBody, scheduleType: 'group' });
    const result = validateRequestParameters(input);
    expect(result.scheduleType).toBe('group');
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { body: '' });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when slug is missing', () => {
    const input = createMockZambdaInput({ scheduleType: 'location' });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when scheduleType is invalid', () => {
    const input = createMockZambdaInput({ ...validBody, scheduleType: 'invalid' });
    expect(() => validateRequestParameters(input)).toThrow('scheduleType');
  });

  test('should throw when scheduleType is missing', () => {
    const input = createMockZambdaInput({ slug: 'my-location' });
    expect(() => validateRequestParameters(input)).toThrow('scheduleType');
  });

  test('should throw when selectedDate is not a valid date string', () => {
    const input = createMockZambdaInput({ ...validBody, selectedDate: 'not-a-date' });
    expect(() => validateRequestParameters(input)).toThrow('selectedDate');
  });

  test('should throw when selectedDate is a non-ISO date format', () => {
    const input = createMockZambdaInput({ ...validBody, selectedDate: '01/15/2024' });
    expect(() => validateRequestParameters(input)).toThrow('selectedDate');
  });

  test('should accept valid serviceCategoryCode', () => {
    // serviceCategoryCode is validated against ServiceCategoryCodeSchema from utils
    // Valid codes come from the booking config. We test that invalid ones are rejected.
    const input = createMockZambdaInput({ ...validBody, serviceCategoryCode: 'DEFINITELY_NOT_A_VALID_CODE_xyz' });
    expect(() => validateRequestParameters(input)).toThrow('serviceCategoryCode');
  });

  test('should allow omitting serviceCategoryCode', () => {
    const input = createMockZambdaInput(validBody);
    const result = validateRequestParameters(input);
    expect(result.serviceCategoryCode).toBeUndefined();
  });

  test('SCHEDULE_TYPES should contain expected values', () => {
    expect(SCHEDULE_TYPES).toEqual(['location', 'provider', 'group']);
  });

  test('should pass secrets through from input', () => {
    const secrets = { PROJECT_API: 'https://api.test' };
    const input = createMockZambdaInput(validBody, { secrets });
    const result = validateRequestParameters(input);
    expect(result.secrets).toEqual(secrets);
  });

  // `slug` and `atLocationSlug` are interpolated raw into FHIR `identifier`
  // search params as `${SLUG_SYSTEM}|${value}`. Without a format guard, a
  // `|` (or other special chars) lets a caller break out of the value side
  // and inject extra search clauses. SlugSchema enforces URL-safe shape.
  describe('slug-format validation', () => {
    test('rejects slug containing "|" (injection vector)', () => {
      const input = createMockZambdaInput({ ...validBody, slug: 'legit|extra-clause' });
      expect(() => validateRequestParameters(input)).toThrow('slug');
    });

    test('rejects slug containing a space', () => {
      const input = createMockZambdaInput({ ...validBody, slug: 'legit slug' });
      expect(() => validateRequestParameters(input)).toThrow('slug');
    });

    test('rejects atLocationSlug containing "|" (injection vector)', () => {
      const input = createMockZambdaInput({ ...validBody, atLocationSlug: 'legit|extra-clause' });
      expect(() => validateRequestParameters(input)).toThrow('atLocationSlug');
    });

    test('rejects atLocationSlug that is an empty string', () => {
      const input = createMockZambdaInput({ ...validBody, atLocationSlug: '' });
      expect(() => validateRequestParameters(input)).toThrow('atLocationSlug');
    });

    test('accepts atLocationSlug omitted', () => {
      const input = createMockZambdaInput(validBody);
      const result = validateRequestParameters(input);
      expect(result.atLocationSlug).toBeUndefined();
    });

    test('accepts a valid URL-safe atLocationSlug', () => {
      const input = createMockZambdaInput({ ...validBody, atLocationSlug: 'my-location-2' });
      const result = validateRequestParameters(input);
      expect(result.atLocationSlug).toBe('my-location-2');
    });
  });
});
