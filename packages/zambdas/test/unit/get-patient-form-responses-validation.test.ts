import { describe, expect, it } from 'vitest';
import { validateRequestParameters } from '../../src/ehr/get-patient-form-responses/validateRequestParameters';

const PATIENT_ID = '11111111-1111-4111-8111-111111111111';
const input = (body: unknown): never => ({ body: JSON.stringify(body), headers: {}, secrets: null }) as never;

describe('get-patient-form-responses validation', () => {
  it('accepts a patient and the Screening / Questionnaires placements', () => {
    expect(
      validateRequestParameters(input({ patientId: PATIENT_ID, placements: ['screening', 'questionnaires'] }))
    ).toMatchObject({
      patientId: PATIENT_ID,
      placements: ['screening', 'questionnaires'],
    });
  });

  it('rejects a malformed patient id', () => {
    expect(() => validateRequestParameters(input({ patientId: 'nope', placements: ['screening'] }))).toThrow();
  });

  it('rejects the untagged Visit details placement and an empty list', () => {
    expect(() => validateRequestParameters(input({ patientId: PATIENT_ID, placements: ['visit-details'] }))).toThrow();
    expect(() => validateRequestParameters(input({ patientId: PATIENT_ID, placements: [] }))).toThrow();
  });
});
