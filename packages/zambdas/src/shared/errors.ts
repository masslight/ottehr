import { captureException } from '@sentry/aws-serverless';
import { handleUnknownError } from 'utils';
import { ZambdaInput } from './types';

const REDACTED = '<redacted>';

/**
 * Returns a copy of a ZambdaInput that is safe to log: every value in `secrets` is replaced with
 * '<redacted>' (key names are kept so it's still visible which secrets were present), and any
 * header named `authorization` (case-insensitive) or carrying a `Bearer ` value is redacted.
 * The body and all other headers pass through unchanged. The original input is not mutated.
 */
export const redactZambdaInputForLogging = (input: ZambdaInput): ZambdaInput => {
  const redactedSecrets =
    input.secrets != null
      ? Object.fromEntries(Object.keys(input.secrets).map((key) => [key, REDACTED]))
      : input.secrets;
  const redactedHeaders =
    input.headers != null
      ? Object.fromEntries(
          Object.entries(input.headers as Record<string, unknown>).map(([key, value]) => {
            if (key.toLowerCase() === 'authorization' || (typeof value === 'string' && value.startsWith('Bearer '))) {
              return [key, REDACTED];
            }
            return [key, value];
          })
        )
      : input.headers;
  return { ...input, headers: redactedHeaders, secrets: redactedSecrets };
};

export const sendErrors = async (error: any, env: string, tags?: Record<string, string>): Promise<void> => {
  if (process.env.PLAYWRIGHT_SUITE_ID != null || ['local'].includes(env)) {
    return;
  }
  console.log('sendErrors running');

  const errorToThrow = handleUnknownError(error);
  captureException(errorToThrow, tags ? { tags } : undefined);
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
