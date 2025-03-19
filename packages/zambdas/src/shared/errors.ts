import sendgrid, { ClientResponse } from '@sendgrid/mail';
import { DateTime } from 'luxon';
import { getSecret, Secrets, SecretsKeys } from 'zambda-utils';

export async function topLevelCatch(zambda: string, error: any, secrets: Secrets | null): Promise<void> {
  console.error(`Top level catch block in ${zambda}: \n ${error} \n Error stringified: ${JSON.stringify(error)}`);
  await sendErrors(zambda, error, secrets);
}

export const sendErrors = async (zambda: string, error: any, secrets: Secrets | null): Promise<void> => {
  const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, secrets);
  // Only fires in staging and production
  if (!['staging', 'production'].includes(ENVIRONMENT)) {
    return;
  }

  console.log('Sending error message to Slack');
  // const notification = ENVIRONMENT === 'production' ? '@channel' : '@ottehr-devs';
  const slackMessage = `todo Alert in ${ENVIRONMENT} zambda ${zambda}.\n\n${error}\n\n${JSON.stringify(error)}`;
  await sendSlackNotification(slackMessage, ENVIRONMENT);

  const email = 'support@masslight.com';
  const errorMessage = `Error in ${zambda}.\n${error}.\nError stringified: ${JSON.stringify(error)}`;
  const SENDGRID_ERROR_EMAIL_TEMPLATE_ID = getSecret(SecretsKeys.IN_PERSON_SENDGRID_ERROR_EMAIL_TEMPLATE_ID, secrets);

  console.log('Sending error email');
  try {
    const sendResult = await sendgridEmail(
      secrets,
      SENDGRID_ERROR_EMAIL_TEMPLATE_ID,
      [email],
      email,
      ENVIRONMENT,
      errorMessage
    );
    if (sendResult)
      console.log(
        `Details of successful sendgrid send: statusCode, ${sendResult[0].statusCode}. body, ${JSON.stringify(
          sendResult[0].body
        )}`
      );
  } catch (error) {
    console.error(`Error sending email to ${email}: ${JSON.stringify(error)}`);
    // Re-throw error so caller knows we failed.
    throw error;
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

  const sendResult = await sendgrid.send(emailConfiguration);
  return sendResult;
};
