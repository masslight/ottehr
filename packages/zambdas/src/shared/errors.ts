import { captureException, captureMessage } from '@sentry/aws-serverless';
import { handleUnknownError } from 'utils';

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
