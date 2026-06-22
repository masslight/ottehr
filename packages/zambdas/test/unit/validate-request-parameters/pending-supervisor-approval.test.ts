import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/ehr/pending-supervisor-approval/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('pending-supervisor-approval - validateRequestParameters', () => {
  const secrets = createMockSecrets();

  const validBody = {
    encounterId: '550e8400-e29b-41d4-a716-446655440000',
    practitionerId: '660e8400-e29b-41d4-a716-446655440000',
  };

  test('should return validated params when all required fields provided', () => {
    const input = createMockZambdaInput(validBody, { secrets });
    const result = validateRequestParameters(input);

    expect(result.encounterId).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(result.practitionerId).toBe('660e8400-e29b-41d4-a716-446655440000');
    expect(result.secrets).toBe(secrets);
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

  test('should throw when encounterId is not a valid UUID', () => {
    const input = createMockZambdaInput({ ...validBody, encounterId: 'not-a-uuid' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when practitionerId is not a valid UUID', () => {
    const input = createMockZambdaInput({ ...validBody, practitionerId: 'not-a-uuid' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });
});
