import { captureException } from '@sentry/aws-serverless';
import { handleUnknownError } from 'utils';

export const sendErrors = async (error: any, env: string): Promise<void> => {
  if (['local'].includes(env)) {
    return;
  }
  console.log('sendErrors running');

  const errorToThrow = handleUnknownError(error);
  captureException(errorToThrow);
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
