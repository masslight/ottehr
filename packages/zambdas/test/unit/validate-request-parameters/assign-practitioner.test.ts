import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/ehr/assign-practitioner/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('assign-practitioner - validateRequestParameters', () => {
  const validBody = {
    encounterId: '550e8400-e29b-41d4-a716-446655440000',
    practitionerId: '660e8400-e29b-41d4-a716-446655440001',
    userRole: [
      { system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType', code: 'ADM', display: 'admitter' },
    ],
  };

  const secrets = createMockSecrets();

  test('should return validated params when all required fields provided', () => {
    const input = createMockZambdaInput(validBody, { secrets });
    const result = validateRequestParameters(input);

    expect(result.encounterId).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(result.practitionerId).toBe('660e8400-e29b-41d4-a716-446655440001');
    expect(result.userRole).toEqual(validBody.userRole);
    expect(result.secrets).toBe(secrets);
    expect(result.userToken).toBe('test-token');
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { body: '', secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when encounterId is not a string', () => {
    const input = createMockZambdaInput({ ...validBody, encounterId: 123 }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when encounterId is not a valid UUID', () => {
    const input = createMockZambdaInput({ ...validBody, encounterId: 'not-a-uuid' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when practitionerId is missing', () => {
    const { practitionerId: _, ...rest } = validBody;
    const input = createMockZambdaInput(rest, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when practitionerId is not a string', () => {
    const input = createMockZambdaInput({ ...validBody, practitionerId: 123 }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when practitionerId is not a valid UUID', () => {
    const input = createMockZambdaInput({ ...validBody, practitionerId: 'not-a-uuid' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when userRole is not an array', () => {
    const input = createMockZambdaInput({ ...validBody, userRole: 'not-array' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when userRole item is not an object', () => {
    const input = createMockZambdaInput({ ...validBody, userRole: ['not-object'] }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when userRole item has non-string code', () => {
    const input = createMockZambdaInput(
      { ...validBody, userRole: [{ code: 123, display: 'test', system: 'test' }] },
      { secrets }
    );
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when userRole item has non-string display', () => {
    const input = createMockZambdaInput(
      { ...validBody, userRole: [{ code: 'ADM', display: 123, system: 'test' }] },
      { secrets }
    );
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when userRole item has non-string system', () => {
    const input = createMockZambdaInput(
      { ...validBody, userRole: [{ code: 'ADM', display: 'test', system: 123 }] },
      { secrets }
    );
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when secrets is null', () => {
    const input = createMockZambdaInput(validBody, { secrets: null });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should accept userRole with empty coding objects', () => {
    const input = createMockZambdaInput({ ...validBody, userRole: [{}] }, { secrets });
    const result = validateRequestParameters(input);
    expect(result.userRole).toEqual([{}]);
  });

  test('should accept empty userRole array', () => {
    const input = createMockZambdaInput({ ...validBody, userRole: [] }, { secrets });
    const result = validateRequestParameters(input);
    expect(result.userRole).toEqual([]);
  });

  test('should throw when encounterId is empty string', () => {
    const input = createMockZambdaInput({ ...validBody, encounterId: '' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when practitionerId is empty string', () => {
    const input = createMockZambdaInput({ ...validBody, practitionerId: '' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });
});
