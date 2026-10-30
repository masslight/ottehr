import Oystehr from '@oystehr/sdk';
import { APIErrorCode } from 'utils/lib/types/errors';
import { describe, expect, it } from 'vitest';
import { fhirValidationErrorToApiError } from '../../src/shared/errors';

const fhirError = (code: number, issue: object[]): Error =>
  new Oystehr.OystehrFHIRError({ code, error: { resourceType: 'OperationOutcome', issue } as any });

describe('fhirValidationErrorToApiError', () => {
  it('surfaces the error issues of a rejected transaction', () => {
    const error = fhirError(422, [
      { severity: 'error', code: 'invalid', details: { text: 'MedicationAdministration.status is required' } },
      { severity: 'warning', code: 'informational', details: { text: 'ignored warning' } },
      { severity: 'fatal', code: 'structure', diagnostics: 'Unknown element "foo"' },
    ]);

    expect(fhirValidationErrorToApiError(error)).toEqual({
      code: APIErrorCode.FHIR_RESOURCE_VALIDATION_ERROR,
      statusCode: 422,
      message: 'FHIR validation failed: MedicationAdministration.status is required; Unknown element "foo"',
    });
  });

  it('falls back to the error message when the outcome has no error text', () => {
    const error = fhirError(400, []);

    expect(fhirValidationErrorToApiError(error)?.message).toBe(`FHIR validation failed: ${error.message}`);
  });

  // The element paths say WHICH field the server rejected, which is the difference between a
  // reportable error and a guessing game: `Invalid date format` alone names no field.
  it('names the rejected element alongside the issue text', () => {
    const error = fhirError(400, [
      {
        severity: 'error',
        code: 'structure',
        details: { text: 'Invalid date format - POST /Patient' },
        expression: ['Patient.birthDate'],
      },
    ]);

    expect(fhirValidationErrorToApiError(error)?.message).toBe(
      'FHIR validation failed: Invalid date format - POST /Patient (Patient.birthDate)'
    );
  });

  it('falls back to the element path when an issue carries no text', () => {
    const error = fhirError(400, [{ severity: 'error', code: 'structure', expression: ['Patient.birthDate'] }]);

    expect(fhirValidationErrorToApiError(error)?.message).toBe('FHIR validation failed: Patient.birthDate');
  });

  it('leaves non-validation errors alone', () => {
    expect(fhirValidationErrorToApiError(fhirError(500, [{ severity: 'error', code: 'exception' }]))).toBeUndefined();
    expect(fhirValidationErrorToApiError(fhirError(404, [{ severity: 'error', code: 'not-found' }]))).toBeUndefined();
    expect(fhirValidationErrorToApiError(new Error('boom'))).toBeUndefined();
  });

  // A non-FHIR SDK failure carries an HTTP status on `code` but no OperationOutcome, so there is
  // nothing to tell the caller about their input.
  it('leaves a non-FHIR SDK error alone', () => {
    expect(
      fhirValidationErrorToApiError(new Oystehr.OystehrSdkError({ message: 'Bad Request', code: 400 }))
    ).toBeUndefined();
  });

  // APIErrorCodes are 4000+, never HTTP statuses, so an APIError our own validation threw must not
  // be mistaken for a FHIR rejection and rewritten.
  it('leaves an APIError alone', () => {
    expect(
      fhirValidationErrorToApiError({ code: APIErrorCode.INVALID_INPUT, message: '"patient.dateOfBirth" is invalid' })
    ).toBeUndefined();
  });
});
