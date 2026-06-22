import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/ehr/unassign-practitioner/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('unassign-practitioner - validateRequestParameters', () => {
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

  test('should throw when encounterId is missing', () => {
    const { encounterId: _, ...rest } = validBody;
    const input = createMockZambdaInput(rest, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when practitionerId is missing', () => {
    const { practitionerId: _, ...rest } = validBody;
    const input = createMockZambdaInput(rest, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when userRole is missing', () => {
    const { userRole: _, ...rest } = validBody;
    const input = createMockZambdaInput(rest, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when secrets is null', () => {
    const input = createMockZambdaInput(validBody, { secrets: null });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when encounterId is not a valid UUID', () => {
    const input = createMockZambdaInput({ ...validBody, encounterId: 'not-a-uuid' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when practitionerId is not a valid UUID', () => {
    const input = createMockZambdaInput({ ...validBody, practitionerId: 'not-a-uuid' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when encounterId is empty string', () => {
    const input = createMockZambdaInput({ ...validBody, encounterId: '' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });
});
