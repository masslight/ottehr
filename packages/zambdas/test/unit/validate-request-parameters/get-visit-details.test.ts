import { describe, expect, test } from 'vitest';
import { GetVisitDetailsBodySchema } from '../../../src/patient/appointment/get-visit-details/index';
import { validateWithSchema } from '../../../src/shared/validation';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('get-visit-details - validateRequestParameters', () => {
  const secrets = createMockSecrets();

  test('should return validated params for a valid request', () => {
    const input = createMockZambdaInput({ appointmentId: '550e8400-e29b-41d4-a716-446655440000' }, { secrets });
    const result = validateWithSchema(GetVisitDetailsBodySchema, input);
    expect(result).toEqual({
      appointmentId: '550e8400-e29b-41d4-a716-446655440000',
      secrets,
    });
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { secrets });
    expect(() => validateWithSchema(GetVisitDetailsBodySchema, input)).toThrow();
  });

  test('should throw when appointmentId is missing', () => {
    const input = createMockZambdaInput({}, { secrets });
    expect(() => validateWithSchema(GetVisitDetailsBodySchema, input)).toThrow();
  });

  test('should throw when appointmentId is not a valid UUID', () => {
    const input = createMockZambdaInput({ appointmentId: 'appt-not-a-uuid' }, { secrets });
    expect(() => validateWithSchema(GetVisitDetailsBodySchema, input)).toThrow();
  });
});
