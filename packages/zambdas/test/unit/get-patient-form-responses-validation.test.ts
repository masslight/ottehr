import { GetPatientFormResponsesInputSchema } from 'utils/lib/types/data/practice-managed-questionnaires/practice-managed-questionnaire.schema';
import { APIErrorCode } from 'utils/lib/types/errors';
import { describe, expect, it } from 'vitest';
import { validateWithSchema } from '../../src/shared/validation';

const PATIENT_ID = '11111111-1111-4111-8111-111111111111';
const input = (body: unknown): never => ({ body: JSON.stringify(body), headers: {}, secrets: {} }) as never;
const validate = (body: unknown): unknown => validateWithSchema(GetPatientFormResponsesInputSchema, input(body));

describe('get-patient-form-responses validation', () => {
  it('accepts a patient and the Screening / Questionnaires placements', () => {
    expect(validate({ patientId: PATIENT_ID, placements: ['screening', 'questionnaires'] })).toMatchObject({
      patientId: PATIENT_ID,
      placements: ['screening', 'questionnaires'],
    });
  });

  it('rejects a malformed patient id', () => {
    expect(() => validate({ patientId: 'nope', placements: ['screening'] })).toThrow();
  });

  it('rejects the untagged Visit details placement and an empty list', () => {
    expect(() => validate({ patientId: PATIENT_ID, placements: ['visit-details'] })).toThrow();
    expect(() => validate({ patientId: PATIENT_ID, placements: [] })).toThrow();
  });

  it('rejects a JSON null body as invalid input rather than crashing on it', () => {
    let thrown: unknown;
    try {
      validate(null);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toMatchObject({ code: APIErrorCode.INVALID_INPUT });
  });
});
