/**
 * One place for "what does an eRx failure mean".
 *
 * The shape these helpers are written around, because it is not the obvious one: the Oystehr eRx API
 * reports a failure as an `OystehrSdkError` whose `code` is the *response body's* eRx-internal code —
 * a 4-digit value that arrives as a **string** — and not the HTTP status. The status is generally
 * unrecoverable from the thrown error: the SDK's retry loop reassigns `lastErr = { message, code }` and
 * `SDKResource.request` then re-wraps it as a fresh `OystehrSdkError` exposing only
 * `{ name, message, code, cause }`, so the `Response` is gone by the time it reaches us.
 *
 * Both views of an eRx error live here together so they cannot drift apart again — keeping them in
 * separate modules is what let a since-removed `helpers/apiErrors` ship comparing `code === 403` while
 * the mapper below, two directories away, already declared `code` a string.
 */

/** The error shape the eRx SDK actually throws, as far as callers can rely on it. */
export interface ErxError {
  code?: string | number;
  message?: string;
}

const PERMISSION_DENIED_STATUSES = new Set([401, 403]);

/**
 * Best-effort detection of an authorization failure.
 *
 * Best-effort is load-bearing: per the note above, an eRx denial usually carries an internal code
 * rather than a status, so this can return false for a genuine 403 and there is currently no way to
 * tell. Two rules follow, and callers must honour both:
 *
 *  - **Fail closed.** Use this only to choose a more specific message. Never treat "not detected as a
 *    denial" as "the request succeeded" — resolving to an empty result would report a permission
 *    problem as "nothing found", which tells the user something false about their patient.
 *  - **Do not gate polling on it.** Stop on any error; a missed denial must not retry forever.
 */
export const isErxPermissionDeniedError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }
  // `statusCode` covers Ottehr's own APIError shape; `status` covers plain fetch/HTTP-ish errors.
  const { code, status, statusCode } = error as Record<string, unknown>;
  return [code, status, statusCode].some((value) => {
    const numeric = typeof value === 'string' ? Number(value) : value;
    return typeof numeric === 'number' && PERMISSION_DENIED_STATUSES.has(numeric);
  });
};

/**
 * Maps an eRx `syncPatient` failure to a user-facing message. Shared so both eRx flows surface
 * the same guidance (bad phone, missing weight for minors, unconfigured service, etc.).
 */
export const getErxPatientSyncErrorMessage = (error: ErxError, phoneNumber?: string): string => {
  if (error.code === '4006') {
    if (error.message?.toLowerCase()?.includes('phone')) {
      return `Patient has specified some wrong phone number: ${phoneNumber}. Please provide a real patient's phone number`;
    }
    if (error.message?.includes('eRx service is not configured')) {
      return `eRx service is not configured. Please contact support.`;
    }
    if (error.message?.includes('Weight must be entered for patient 18 years old and under')) {
      return `Weight must be entered for patient 18 years old and under. Please specify patient's weight in the 'Vitals' tab.`;
    }
    return `Something is wrong with patient data.`;
  }
  return 'Something went wrong while trying to sync patient to eRx';
};
