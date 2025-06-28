import sendgrid, { ClientResponse } from '@sendgrid/mail';
import { captureException } from '@sentry/aws-serverless';
import { DateTime } from 'luxon';
import { getSecret, handleUnknownError, Secrets, SecretsKeys } from 'utils';

export const sendErrors = async (error: any, env: string, shouldCaptureException?: boolean): Promise<void> => {
  // Only fires in testing, staging and production
  if (!['testing', 'staging', 'production'].includes(env)) {
    return;
  }
  console.log('sendErrors running');

  if (shouldCaptureException) {
    const errorToThrow = handleUnknownError(error);
    captureException(errorToThrow);
  }
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

export const sendgridEmail = async (
  secrets: Secrets | null,
  sendgridTemplateId: string,
  toEmail: string[],
  fromEmail: string,
  env: string,
  message: string
): Promise<[ClientResponse, unknown] | undefined> => {
  const SENDGRID_API_KEY = getSecret(SecretsKeys.SENDGRID_API_KEY, secrets);
  if (!(SENDGRID_API_KEY && sendgridTemplateId)) {
    console.error(
      "Email message can't be sent because either Sendgrid api key or message template ID variable was not set"
    );
    return;
  }
  sendgrid.setApiKey(SENDGRID_API_KEY);
  console.log('toEmail', toEmail);
  const emailConfiguration = {
    to: toEmail,
    from: {
      email: fromEmail,
      name: 'Ottehr',
    },
    replyTo: fromEmail,
    templateId: sendgridTemplateId,
    dynamic_template_data: {
      environment: env,
      errorMessage: message,
      timestamp: DateTime.now().setZone('UTC').toFormat("EEEE, MMMM d, yyyy 'at' h:mm a ZZZZ"),
    },
  };

  try {
    const sendResult = await sendgrid.send(emailConfiguration);
    return sendResult;
  } catch (error) {
    console.error('Error sending email:', error);
    void sendErrors(error, getSecret(SecretsKeys.ENVIRONMENT, secrets));
    return;
  }
};
