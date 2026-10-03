import { captureException, captureMessage } from '@sentry/aws-serverless';
import { OperationOutcome, OperationOutcomeIssue } from 'fhir/r4b';
import { handleUnknownError } from 'utils/lib/fhir/helpers';
import { APIError, APIErrorCode } from 'utils/lib/types/errors';

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

/**
 * Statuses that mean "the content we sent is invalid". Other client errors are deliberately left
 * alone: a 401/403 is our M2M client's problem rather than the caller's, and relabelling it would
 * tell a patient they are unauthorized when the service is misconfigured.
 */
const FHIR_REJECTION_STATUSES = [400, 422];

const describeOperationOutcome = (issues: OperationOutcomeIssue[]): string | undefined => {
  const described = issues
    .filter((issue) => issue.severity === 'error' || issue.severity === 'fatal')
    .map((issue) => {
      const text = issue.details?.text ?? issue.diagnostics;
      const where = issue.expression?.join(', ');
      if (!text) return where;
      return where ? `${text} (${where})` : text;
    })
    .filter((described): described is string => Boolean(described));

  return described.length > 0 ? described.join('; ') : undefined;
};

/**
 * Translates a FHIR API rejection of a resource we wrote into an `APIError`, so `topLevelCatch`
 * returns the status the FHIR server gave instead of a blanket 500. Returns undefined for anything
 * else, which the caller should rethrow unchanged.
 */
export const fhirRejectionToApiError = (error: unknown): APIError | undefined => {
  if (error == null || typeof error !== 'object') return undefined;

  const { code, cause, message } = error as { code?: unknown; cause?: unknown; message?: unknown };
  if (typeof code !== 'number' || !FHIR_REJECTION_STATUSES.includes(code)) return undefined;

  const outcome = cause as OperationOutcome | undefined;
  if (outcome?.resourceType !== 'OperationOutcome') return undefined;

  const detail = describeOperationOutcome(outcome.issue ?? []) ?? (typeof message === 'string' ? message : undefined);

  return {
    code: APIErrorCode.FHIR_RESOURCE_VALIDATION_ERROR,
    statusCode: code,
    message: detail
      ? `The request was rejected as invalid by the FHIR API: ${detail}`
      : 'The request was rejected as invalid by the FHIR API',
  };
};
