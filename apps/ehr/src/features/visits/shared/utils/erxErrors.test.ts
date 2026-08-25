import { describe, expect, it } from 'vitest';
import { getErxPatientSyncErrorMessage, isErxPermissionDeniedError } from './erxErrors';

describe('getErxPatientSyncErrorMessage', () => {
  it('returns the generic message for non-4006 errors', () => {
    expect(getErxPatientSyncErrorMessage({ code: '5000', message: 'boom' })).toBe(
      'Something went wrong while trying to sync patient to eRx'
    );
    expect(getErxPatientSyncErrorMessage({})).toBe('Something went wrong while trying to sync patient to eRx');
  });

  it('maps a 4006 phone error and includes the provided phone number', () => {
    expect(getErxPatientSyncErrorMessage({ code: '4006', message: 'Invalid phone number' }, '+1 555 000 1111')).toBe(
      "Patient has specified some wrong phone number: +1 555 000 1111. Please provide a real patient's phone number"
    );
  });

  it('maps a 4006 unconfigured-service error', () => {
    expect(getErxPatientSyncErrorMessage({ code: '4006', message: 'eRx service is not configured' })).toBe(
      'eRx service is not configured. Please contact support.'
    );
  });

  it('maps a 4006 missing-weight error for minors', () => {
    expect(
      getErxPatientSyncErrorMessage({
        code: '4006',
        message: 'Weight must be entered for patient 18 years old and under',
      })
    ).toBe(
      "Weight must be entered for patient 18 years old and under. Please specify patient's weight in the 'Vitals' tab."
    );
  });

  it('falls back to a generic patient-data message for other 4006 errors', () => {
    expect(getErxPatientSyncErrorMessage({ code: '4006', message: 'something else' })).toBe(
      'Something is wrong with patient data.'
    );
  });
});

// The 4-digit cases are the important negatives, and the reason the mapper above types `code` as a
// string: an eRx failure carries an internal code, not the HTTP status. They are why callers must fail
// closed rather than reading "not a denial" as "the request was fine".
describe('isErxPermissionDeniedError', () => {
  it.each([
    ['the status in code', { code: 403 }],
    ['a 401 in code', { code: 401 }],
    ['a status field', { status: 403 }],
    ["Ottehr's APIError shape", { statusCode: 403 }],
    ['a stringified status', { code: '403' }],
  ])('detects %s', (_label, error) => {
    expect(isErxPermissionDeniedError(error)).toBe(true);
  });

  it.each([
    ['an eRx internal code', { code: 4006 }],
    ['an eRx internal code as a string', { code: '4006' }],
    ['a not-found', { code: 404 }],
    ['a server error', { statusCode: 500 }],
    ['a bare Error', new Error('boom')],
    ['null', null],
    ['undefined', undefined],
    ['a string', '403'],
  ])('does not report %s as a permission denial', (_label, error) => {
    expect(isErxPermissionDeniedError(error)).toBe(false);
  });
});
