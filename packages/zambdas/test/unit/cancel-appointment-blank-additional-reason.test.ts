import { describe, expect, test } from 'vitest';
import { validateRequestParameters as validatePrebookCancel } from '../../src/patient/appointment/prebook-cancel-appointment/validateRequestParameters';
import { validateRequestParameters as validateTelemedCancel } from '../../src/patient/appointment/telemed-cancel-appointment/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './validate-request-parameters/helpers';

const APPOINTMENT_ID = '550e8400-e29b-41d4-a716-446655440000';

const validators = [
  ['prebook-cancel-appointment', validatePrebookCancel, 'patient-request'],
  ['telemed-cancel-appointment', validateTelemedCancel, 'Patient improved'],
] as const;

const additionalReasonFor = (
  validate: (typeof validators)[number][1],
  cancellationReason: string,
  cancellationReasonAdditional: unknown
): string | undefined =>
  validate(
    createMockZambdaInput(
      { appointmentID: APPOINTMENT_ID, cancellationReason, cancellationReasonAdditional },
      { secrets: createMockSecrets() }
    )
  ).cancellationReasonAdditional;

describe.each(validators)('%s cancellationReasonAdditional', (_name, validate, cancellationReason) => {
  test.each(['', ' ', '   ', '\n\t'])('drops a blank value %j', (value) => {
    expect(additionalReasonFor(validate, cancellationReason, value)).toBeUndefined();
  });

  test('drops a null value', () => {
    expect(additionalReasonFor(validate, cancellationReason, null)).toBeUndefined();
  });

  test('keeps a non-blank value without surrounding whitespace', () => {
    expect(additionalReasonFor(validate, cancellationReason, '  Moved away \n')).toBe('Moved away');
  });
});
