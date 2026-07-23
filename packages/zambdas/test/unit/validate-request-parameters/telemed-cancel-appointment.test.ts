import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/patient/appointment/telemed-cancel-appointment/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('telemed-cancel-appointment - validateRequestParameters', () => {
  const secrets = createMockSecrets();

  const validBody = {
    appointmentID: '550e8400-e29b-41d4-a716-446655440000',
    cancellationReason: 'Patient improved',
    cancellationReasonAdditional: 'Felt better after resting',
  };

  test('should return validated params for a valid request (patient reason)', () => {
    const input = createMockZambdaInput(validBody, { secrets });
    const result = validateRequestParameters(input);

    expect(result.appointmentID).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(result.cancellationReason).toBe('Patient improved');
    expect(result.cancellationReasonAdditional).toBe('Felt better after resting');
    expect(result.secrets).toBe(secrets);
  });

  test('should return validated params for a valid provider reason', () => {
    const input = createMockZambdaInput(
      { ...validBody, cancellationReason: 'Wrong patient name on chart' },
      { secrets }
    );
    const result = validateRequestParameters(input);

    expect(result.cancellationReason).toBe('Wrong patient name on chart');
  });

  test('should return validated params without optional cancellationReasonAdditional', () => {
    const { cancellationReasonAdditional: _, ...bodyWithoutOptional } = validBody;
    const input = createMockZambdaInput(bodyWithoutOptional, { secrets });
    const result = validateRequestParameters(input);

    expect(result.appointmentID).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(result.cancellationReasonAdditional).toBeUndefined();
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when appointmentID is missing', () => {
    const { appointmentID: _, ...rest } = validBody;
    const input = createMockZambdaInput(rest, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when cancellationReason is missing', () => {
    const { cancellationReason: _, ...rest } = validBody;
    const input = createMockZambdaInput(rest, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when appointmentID is not a valid UUID', () => {
    const input = createMockZambdaInput({ ...validBody, appointmentID: 'appt-not-uuid' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when cancellationReason is not a valid enum value', () => {
    const input = createMockZambdaInput({ ...validBody, cancellationReason: 'Invalid reason' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should accept second valid UUID for appointmentID', () => {
    const input = createMockZambdaInput(
      { ...validBody, appointmentID: '6ba7b810-9dad-11d1-80b4-00c04fd430c8' },
      { secrets }
    );
    const result = validateRequestParameters(input);
    expect(result.appointmentID).toBe('6ba7b810-9dad-11d1-80b4-00c04fd430c8');
  });
});
