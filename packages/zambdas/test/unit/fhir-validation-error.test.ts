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

  it('leaves non-validation errors alone', () => {
    expect(fhirValidationErrorToApiError(fhirError(500, [{ severity: 'error', code: 'exception' }]))).toBeUndefined();
    expect(fhirValidationErrorToApiError(fhirError(404, [{ severity: 'error', code: 'not-found' }]))).toBeUndefined();
    expect(fhirValidationErrorToApiError(new Error('boom'))).toBeUndefined();
  });
});
