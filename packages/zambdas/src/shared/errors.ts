import { captureException, captureMessage, withScope } from '@sentry/aws-serverless';
import { handleUnknownError } from 'utils';

export const sendErrors = async (error: any, env: string): Promise<void> => {
  if (process.env.PLAYWRIGHT_SUITE_ID != null || ['local'].includes(env)) {
    return;
  }
  console.log('sendErrors running');

  const errorToThrow = handleUnknownError(error);
  captureException(errorToThrow);
};

/**
 * Reports a violation of the invariant "every Patient has at least one user-relatedperson RelatedPerson"
 * to Sentry. Call from the zero-RP branch of any code path that depends on this invariant, so we
 * notice when the data model gets violated via migration, import, or an unauthorized API path.
 */
export const reportMissingUserRelatedPerson = (site: string, patientId: string | undefined): void => {
  withScope((scope) => {
    scope.setTag('invariant', 'user-relatedperson:>=1');
    scope.setTag('site', site);
    if (patientId) scope.setTag('patientId', patientId);
    captureMessage('Patient has no user-relatedperson (invariant violation)', 'error');
  });
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
