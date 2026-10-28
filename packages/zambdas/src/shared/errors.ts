import Oystehr from '@oystehr/sdk';
import { captureException, captureMessage } from '@sentry/node-core/light';
import { handleUnknownError } from 'utils/lib/fhir/helpers';
import { APIError, FHIR_RESOURCE_VALIDATION_ERROR } from 'utils/lib/types/errors';

export const sendErrors = async (error: any, env: string, tags?: Record<string, string>): Promise<void> => {
  if (process.env.PLAYWRIGHT_SUITE_ID != null || ['local'].includes(env)) {
    return;
  }
  console.log('sendErrors running');

  const errorToThrow = handleUnknownError(error);
  captureException(errorToThrow, tags ? { tags } : undefined);
};

/**
 * Reports an expected-but-notable condition to Sentry at warning level: an operation that couldn't
 * complete because of missing or incomplete data, rather than a code defect. Warnings stay out of the
 * error stream developers triage for bugs, while remaining visible and alertable for whoever fixes
 * the data. Keep `message` static so Sentry groups occurrences into one issue, and put the
 * per-occurrence specifics in `extra`.
 */
export const sendWarning = (
  message: string,
  env: string,
  extra?: Record<string, unknown>,
  tags?: Record<string, string>
): void => {
  if (process.env.PLAYWRIGHT_SUITE_ID != null || ['local'].includes(env)) {
    return;
  }
  captureMessage(message, { level: 'warning', extra, tags });
};

export const sendSlackNotification = async (message: string, env: string): Promise<void> => {
  const url =
    env === 'production'
      ? 'https://hooks.slack.com/services/your_slack_webhook_url'
      : 'https://hooks.slack.com/services/your_slack_webhook_url';

  await fetch(url, {
    method: 'POST',
    body: JSON.stringify({
      text: message,
      link_names: true,
    }),
  });
};

/**
 * Whether a thrown error is a FHIR "resource does not exist" response.
 *
 * The SDK reports FHIR failures as `OystehrFHIRError`, which carries the HTTP status on `code` and
 * the OperationOutcome on `cause` — not on the error itself. Code that tested `error.resourceType`
 * and `error.issue` directly therefore never matched, and treated every 404 as an unexpected failure.
 * Both shapes are accepted here so a raw OperationOutcome (however it reaches us) still resolves.
 */
export const isFhirNotFoundError = (error: unknown): boolean => {
  if (error == null || typeof error !== 'object') return false;
  const candidate = error as { code?: unknown; cause?: unknown; resourceType?: unknown; issue?: unknown };

  if (candidate.code === 404) return true;

  const outcome = (candidate.resourceType === 'OperationOutcome' ? candidate : candidate.cause) as
    | { resourceType?: unknown; issue?: { severity?: string; code?: string }[] }
    | undefined;

  return (
    outcome?.resourceType === 'OperationOutcome' &&
    (outcome.issue ?? []).some((issue) => issue.severity === 'error' && issue.code === 'not-found')
  );
};

// FHIR statuses whose OperationOutcome describes a problem with the submitted resources, which the
// user can fix. Anything else (auth, not found, server failures) stays an internal error.
const FHIR_VALIDATION_STATUS_CODES = [400, 422];

/**
 * Turns a FHIR validation failure into an APIError carrying the OperationOutcome's issues, so the
 * caller sees why the server rejected the resources instead of a bare "Internal error". Returns
 * undefined for any other error, which the caller should rethrow unchanged.
 */
export const fhirValidationErrorToApiError = (error: unknown): APIError | undefined => {
  if (!(error instanceof Oystehr.OystehrFHIRError) || !FHIR_VALIDATION_STATUS_CODES.includes(error.code)) {
    return undefined;
  }
  const issueMessages = (error.cause?.issue ?? [])
    .filter((issue) => issue.severity === 'error' || issue.severity === 'fatal')
    .map((issue) => issue.details?.text ?? issue.diagnostics)
    .filter((message): message is string => Boolean(message));
  const details = issueMessages.length > 0 ? issueMessages.join('; ') : error.message;
  return FHIR_RESOURCE_VALIDATION_ERROR(`FHIR validation failed: ${details}`);
};
