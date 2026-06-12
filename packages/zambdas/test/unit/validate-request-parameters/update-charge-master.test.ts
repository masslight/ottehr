import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/rcm/charge-masters/update-charge-master/validateRequestParameters';
import { createMockZambdaInput } from './helpers';

describe('update-charge-master - validateRequestParameters', () => {
  const validBody = {
    chargeMasterId: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Updated Charge Master',
    effectiveDate: '2024-06-01',
    description: 'An updated description',
  };

  test('should return validated params with all fields', () => {
    const input = createMockZambdaInput(validBody);
    const result = validateRequestParameters(input);

    expect(result.id).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(result.name).toBe('Updated Charge Master');
    expect(result.effectiveDate).toBe('2024-06-01');
    expect(result.description).toBe('An updated description');
    expect(result.secrets).toBeNull();
  });

  test('should map chargeMasterId to id', () => {
    const input = createMockZambdaInput(validBody);
    const result = validateRequestParameters(input);
    expect(result.id).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  test('should default description to empty string when not provided', () => {
    const input = createMockZambdaInput({
      chargeMasterId: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Test',
      effectiveDate: '2024-01-01',
    });
    const result = validateRequestParameters(input);
    expect(result.description).toBe('');
  });

  test('should accept optional status as active', () => {
    const input = createMockZambdaInput({ ...validBody, status: 'active' });
    const result = validateRequestParameters(input);
    expect(result.status).toBe('active');
  });

  test('should accept optional status as retired', () => {
    const input = createMockZambdaInput({ ...validBody, status: 'retired' });
    const result = validateRequestParameters(input);
    expect(result.status).toBe('retired');
  });

  test('should allow status to be undefined', () => {
    const input = createMockZambdaInput(validBody);
    const result = validateRequestParameters(input);
    expect(result.status).toBeUndefined();
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { body: '' });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when chargeMasterId is missing', () => {
    const input = createMockZambdaInput({
      name: 'Test',
      effectiveDate: '2024-01-01',
    });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when name is missing', () => {
    const input = createMockZambdaInput({
      chargeMasterId: '550e8400-e29b-41d4-a716-446655440000',
      effectiveDate: '2024-01-01',
    });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when effectiveDate is missing', () => {
    const input = createMockZambdaInput({
      chargeMasterId: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Test',
    });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when effectiveDate is not a valid date string', () => {
    const input = createMockZambdaInput({ ...validBody, effectiveDate: 'not-a-date' });
    expect(() => validateRequestParameters(input)).toThrow('effectiveDate');
  });

  test('should throw when effectiveDate is a non-ISO date format', () => {
    const input = createMockZambdaInput({ ...validBody, effectiveDate: '01/01/2024' });
    expect(() => validateRequestParameters(input)).toThrow('effectiveDate');
  });

  test('should throw when status is invalid', () => {
    const input = createMockZambdaInput({ ...validBody, status: 'invalid' });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when chargeMasterId is not a valid UUID', () => {
    const input = createMockZambdaInput({
      chargeMasterId: 'cm-123',
      name: 'Test',
      effectiveDate: '2024-01-01',
    });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when both name and effectiveDate are missing', () => {
    const input = createMockZambdaInput({ chargeMasterId: 'not-a-uuid', description: 'just a description' });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should pass secrets through from input', () => {
    const secrets = { PROJECT_API: 'https://api.test' };
    const input = createMockZambdaInput(validBody, { secrets });
    const result = validateRequestParameters(input);
    expect(result.secrets).toEqual(secrets);
  });
});
