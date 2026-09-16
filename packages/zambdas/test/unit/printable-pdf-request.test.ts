import { describe, expect, it } from 'vitest';
import { validateRequestParameters as validateInstructionsRequest } from '../../src/ehr/print-chart-data/make-patient-instructions-pdf/validateRequestParameters';
import { validateRequestParameters as validateProgressNoteRequest } from '../../src/ehr/print-chart-data/make-progress-note-pdf/validateRequestParameters';
import { ZambdaInput } from '../../src/shared/types/common';

// Shared by both print endpoints, which return a patient's clinical documents for whatever visit id
// they are handed — so the request has to be rejected before any of that work starts.

const request = (overrides: Partial<ZambdaInput> = {}): ZambdaInput =>
  ({
    headers: { Authorization: 'Bearer token-abc' },
    body: JSON.stringify({ appointmentId: '3149f8b9-6511-4747-b072-a27388871290' }),
    secrets: null,
    ...overrides,
  }) as ZambdaInput;

// Both endpoints validate the same request against the same shared schema, so both are exercised.
describe.each([
  ['make-progress-note-pdf', validateProgressNoteRequest],
  ['make-patient-instructions-pdf', validateInstructionsRequest],
])('%s validateRequestParameters', (_name, validatePrintablePdfRequest) => {
  it('returns the appointment and the caller token', () => {
    const validated = validatePrintablePdfRequest(request());

    expect(validated.appointmentId).toBe('3149f8b9-6511-4747-b072-a27388871290');
    expect(validated.userToken).toBe('token-abc');
  });

  it('rejects a request with no Authorization header', () => {
    expect(() => validatePrintablePdfRequest(request({ headers: {} as never }))).toThrow();
  });

  it('rejects a missing body', () => {
    expect(() => validatePrintablePdfRequest(request({ body: undefined }))).toThrow();
  });

  // The id addresses a patient's chart, so anything that is not a real appointment id is refused
  // rather than passed through to a FHIR read.
  it('rejects an appointment id that is not a uuid', () => {
    expect(() =>
      validatePrintablePdfRequest(request({ body: JSON.stringify({ appointmentId: 'not-a-uuid' }) }))
    ).toThrow();
  });

  it('rejects a body with no appointment id at all', () => {
    expect(() => validatePrintablePdfRequest(request({ body: JSON.stringify({}) }))).toThrow();
  });
});
