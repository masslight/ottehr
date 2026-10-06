import Oystehr from '@oystehr/sdk';
import { OperationOutcome } from 'fhir/r4b';
import { APIErrorCode } from 'utils/lib/types/errors';
import { describe, expect, it } from 'vitest';
import { fhirRejectionToApiError } from '../../src/shared/errors';

// The OperationOutcome the FHIR API returned for a Patient whose birthDate was not a FHIR `date`.
// Reported as a 500 before this translation existed, because topLevelCatch treats anything that
// isn't an APIError as an internal error.
const invalidBirthDateOutcome: OperationOutcome = {
  resourceType: 'OperationOutcome',
  id: '66fa993b-424e-463e-8942-f0865daebd15',
  issue: [
    {
      severity: 'error',
      code: 'structure',
      details: { text: 'Invalid date format - POST /Patient' },
      expression: ['Patient.birthDate'],
    },
  ],
};

describe('fhirRejectionToApiError', () => {
  it('translates a 400 OystehrFHIRError into a 400 APIError naming the rejected element', () => {
    const error = new Oystehr.OystehrFHIRError({ error: invalidBirthDateOutcome, code: 400 });

    expect(fhirRejectionToApiError(error)).toEqual({
      code: APIErrorCode.FHIR_RESOURCE_VALIDATION_ERROR,
      statusCode: 400,
      message:
        'The request was rejected as invalid by the FHIR API: Invalid date format - POST /Patient (Patient.birthDate)',
    });
  });

  it('passes the FHIR status through rather than flattening every rejection to 400', () => {
    const error = new Oystehr.OystehrFHIRError({ error: invalidBirthDateOutcome, code: 422 });

    expect(fhirRejectionToApiError(error)?.statusCode).toBe(422);
  });

  it('joins multiple error issues', () => {
    const error = new Oystehr.OystehrFHIRError({
      error: {
        resourceType: 'OperationOutcome',
        issue: [
          {
            severity: 'error',
            code: 'structure',
            details: { text: 'Invalid date format' },
            expression: ['Patient.birthDate'],
          },
          { severity: 'error', code: 'structure', diagnostics: 'Unknown gender' },
        ],
      },
      code: 400,
    });

    expect(fhirRejectionToApiError(error)?.message).toBe(
      'The request was rejected as invalid by the FHIR API: Invalid date format (Patient.birthDate); Unknown gender'
    );
  });

  it('ignores non-error issues so a warning does not become the whole message', () => {
    const error = new Oystehr.OystehrFHIRError({
      error: {
        resourceType: 'OperationOutcome',
        issue: [
          { severity: 'warning', code: 'informational', details: { text: 'Deprecated extension' } },
          { severity: 'error', code: 'structure', details: { text: 'Invalid date format' } },
        ],
      },
      code: 400,
    });

    expect(fhirRejectionToApiError(error)?.message).toBe(
      'The request was rejected as invalid by the FHIR API: Invalid date format'
    );
  });

  it('falls back to the error message when the outcome carries no usable issue text', () => {
    const error = new Oystehr.OystehrFHIRError({
      error: { resourceType: 'OperationOutcome', issue: [] },
      code: 400,
    });

    expect(fhirRejectionToApiError(error)?.message).toBe(
      'The request was rejected as invalid by the FHIR API: Unknown FHIR error'
    );
  });

  // Everything below stays a 500: the caller rethrows it unchanged and topLevelCatch reports it.
  it.each([401, 403, 404, 409, 412, 500, 502])('leaves a %i rejection alone', (code) => {
    const error = new Oystehr.OystehrFHIRError({ error: invalidBirthDateOutcome, code });

    expect(fhirRejectionToApiError(error)).toBeUndefined();
  });

  it('leaves a non-FHIR SDK error alone, since it carries no OperationOutcome', () => {
    const error = new Oystehr.OystehrSdkError({ message: 'Bad Request', code: 400 });

    expect(fhirRejectionToApiError(error)).toBeUndefined();
  });

  // 4000-4999 are APIErrorCodes, never HTTP statuses, so an APIError thrown by our own validation
  // must not be mistaken for a FHIR rejection.
  it('leaves an APIError alone', () => {
    expect(
      fhirRejectionToApiError({ code: APIErrorCode.INVALID_INPUT, message: '"patient.dateOfBirth" is invalid' })
    ).toBeUndefined();
  });

  it.each([[null], [undefined], ['Bad Request'], [new Error('boom')]])('leaves %s alone', (error) => {
    expect(fhirRejectionToApiError(error)).toBeUndefined();
  });
});
