import { describe, expect, test } from 'vitest';
import { validateRequestParameters as validatePrebookCancelParams } from '../../src/patient/appointment/prebook-cancel-appointment/validateRequestParameters';
import { validateRequestParameters as validateTelemedCancelParams } from '../../src/patient/appointment/telemed-cancel-appointment/validateRequestParameters';
import { ZambdaInput } from '../../src/shared';

const createMockZambdaInput = (body: any): ZambdaInput => ({
  body: JSON.stringify(body),
  headers: {
    Authorization: 'Bearer test-token',
  },
  secrets: null,
});

describe('Prebook Cancel Appointment - validateRequestParameters', () => {
  test('should validate input with all required fields', () => {
    const input = createMockZambdaInput({
      appointmentID: 'test-appointment-id',
      cancellationReason: 'Patient improved',
    });

    const result = validatePrebookCancelParams(input);

    expect(result.appointmentID).toBe('test-appointment-id');
    expect(result.cancellationReason).toBe('Patient improved');
    expect(result.cancellationReasonAdditional).toBeUndefined();
  });

  test('should validate input with cancellationReasonAdditional as string', () => {
    const input = createMockZambdaInput({
      appointmentID: 'test-appointment-id',
      cancellationReason: 'Other',
      cancellationReasonAdditional: 'Found a closer clinic',
    });

    const result = validatePrebookCancelParams(input);

    expect(result.appointmentID).toBe('test-appointment-id');
    expect(result.cancellationReason).toBe('Other');
    expect(result.cancellationReasonAdditional).toBe('Found a closer clinic');
  });

  test('should validate input with optional language parameter', () => {
    const input = createMockZambdaInput({
      appointmentID: 'test-appointment-id',
      cancellationReason: 'Patient improved',
      language: 'es',
    });

    const result = validatePrebookCancelParams(input);

    expect(result.language).toBe('es');
  });

  test('should validate input with optional silent parameter', () => {
    const input = createMockZambdaInput({
      appointmentID: 'test-appointment-id',
      cancellationReason: 'Patient improved',
      silent: true,
    });

    const result = validatePrebookCancelParams(input);

    expect(result.silent).toBe(true);
  });

  test('should throw error when body is missing', () => {
    const input: ZambdaInput = {
      body: '',
      headers: {
        Authorization: 'Bearer test-token',
      },
      secrets: null,
    };

    expect(() => validatePrebookCancelParams(input)).toThrow('The request was missing a required request body');
  });

  test('should throw error when appointmentID is missing', () => {
    const input = createMockZambdaInput({
      cancellationReason: 'Patient improved',
    });

    expect(() => validatePrebookCancelParams(input)).toThrow('appointmentID');
  });

  test('should throw error when cancellationReason is missing', () => {
    const input = createMockZambdaInput({
      appointmentID: 'test-appointment-id',
    });

    expect(() => validatePrebookCancelParams(input)).toThrow('cancellationReason');
  });

  test('should throw error when cancellationReason is not a string', () => {
    const input = createMockZambdaInput({
      appointmentID: 'test-appointment-id',
      cancellationReason: 123,
    });

    expect(() => validatePrebookCancelParams(input)).toThrow('"cancellationReason" must be a string');
  });

  test('should throw error when cancellationReasonAdditional is not a string', () => {
    const input = createMockZambdaInput({
      appointmentID: 'test-appointment-id',
      cancellationReason: 'Other',
      cancellationReasonAdditional: 123,
    });

    expect(() => validatePrebookCancelParams(input)).toThrow(
      '"cancellationReasonAdditional" must be a string if included'
    );
  });

  test('should throw error when cancellationReasonAdditional is an object', () => {
    const input = createMockZambdaInput({
      appointmentID: 'test-appointment-id',
      cancellationReason: 'Other',
      cancellationReasonAdditional: { reason: 'test' },
    });

    expect(() => validatePrebookCancelParams(input)).toThrow(
      '"cancellationReasonAdditional" must be a string if included'
    );
  });

  test('should throw error when cancellationReasonAdditional is an array', () => {
    const input = createMockZambdaInput({
      appointmentID: 'test-appointment-id',
      cancellationReason: 'Other',
      cancellationReasonAdditional: ['reason1', 'reason2'],
    });

    expect(() => validatePrebookCancelParams(input)).toThrow(
      '"cancellationReasonAdditional" must be a string if included'
    );
  });

  test('should accept empty string for cancellationReasonAdditional', () => {
    const input = createMockZambdaInput({
      appointmentID: 'test-appointment-id',
      cancellationReason: 'Other',
      cancellationReasonAdditional: '',
    });

    const result = validatePrebookCancelParams(input);

    expect(result.cancellationReasonAdditional).toBe('');
  });
});

describe('Telemed Cancel Appointment - validateRequestParameters', () => {
  test('should validate input with all required fields', () => {
    const input = createMockZambdaInput({
      appointmentID: 'test-appointment-id',
      cancellationReason: 'Patient improved',
    });

    const result = validateTelemedCancelParams(input);

    expect(result.appointmentID).toBe('test-appointment-id');
    expect(result.cancellationReason).toBe('Patient improved');
    expect(result.cancellationReasonAdditional).toBeUndefined();
  });

  test('should validate input with cancellationReasonAdditional', () => {
    const input = createMockZambdaInput({
      appointmentID: 'test-appointment-id',
      cancellationReason: 'Technical issue',
      cancellationReasonAdditional: 'Moving to a different state',
    });

    const result = validateTelemedCancelParams(input);

    expect(result.appointmentID).toBe('test-appointment-id');
    expect(result.cancellationReason).toBe('Technical issue');
    expect(result.cancellationReasonAdditional).toBe('Moving to a different state');
  });

  test('should throw error when body is missing', () => {
    const input: ZambdaInput = {
      body: '',
      headers: {
        Authorization: 'Bearer test-token',
      },
      secrets: null,
    };

    expect(() => validateTelemedCancelParams(input)).toThrow('No request body provided');
  });

  test('should throw error when appointmentID is missing', () => {
    const input = createMockZambdaInput({
      cancellationReason: 'patient-changing-location',
    });

    expect(() => validateTelemedCancelParams(input)).toThrow('appointmentID');
  });

  test('should throw error when cancellationReason is missing', () => {
    const input = createMockZambdaInput({
      appointmentID: 'test-appointment-id',
    });

    expect(() => validateTelemedCancelParams(input)).toThrow('cancellationReason');
  });

  test('should validate with valid patient cancellation reason', () => {
    const input = createMockZambdaInput({
      appointmentID: 'test-appointment-id',
      cancellationReason: 'Wait time too long',
    });

    expect(() => validateTelemedCancelParams(input)).not.toThrow();
  });

  test('should validate with valid provider cancellation reason', () => {
    const input = createMockZambdaInput({
      appointmentID: 'test-appointment-id',
      cancellationReason: 'Patient did not answer after multiple attempts',
    });

    expect(() => validateTelemedCancelParams(input)).not.toThrow();
  });

  test('should throw error for invalid cancellation reason', () => {
    const input = createMockZambdaInput({
      appointmentID: 'test-appointment-id',
      cancellationReason: 'invalid-reason',
    });

    expect(() => validateTelemedCancelParams(input)).toThrow('cancellationReason');
  });
});
