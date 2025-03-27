import sendgrid, { ClientResponse } from '@sendgrid/mail';
import { DateTime } from 'luxon';
import { getSecret, isFHIRError, Secrets, SecretsKeys, PROJECT_NAME, SUPPORT_EMAIL } from 'utils';
import { triggerSlackAlarm } from './lambda';

export const sendErrors = async (
  zambda: string,
  error: any,
  secrets: Secrets | null,
  captureSentryException?: (error: any) => void
): Promise<void> => {
  const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, secrets);
  // Only fires in testing, staging and production
  if (!['testing', 'staging', 'production'].includes(ENVIRONMENT)) {
    return;
  }

  if (captureSentryException) {
    captureSentryException(error);
  } else {
    // const notification = ENVIRONMENT === 'production' ? '@channel' : '@ottehr-dev';
    const message = `Alert in ${ENVIRONMENT} zambda ${zambda}.\n\n${
      isFHIRError(error) ? 'FHIR Error' : `${error}\n\n${JSON.stringify(error)}`
    }`;
    await triggerSlackAlarm(message, secrets);
  }

  // Send error to email
  const SENDGRID_API_KEY = getSecret(SecretsKeys.SENDGRID_API_KEY, secrets);
  const SENDGRID_ERROR_EMAIL_TEMPLATE_ID = getSecret(SecretsKeys.IN_PERSON_SENDGRID_ERROR_EMAIL_TEMPLATE_ID, secrets);

  console.log('Sending error email');
  sendgrid.setApiKey(SENDGRID_API_KEY);

  // TODO confirm details
  const email = SUPPORT_EMAIL;
  const emailConfiguration = {
    to: email,
    from: {
      email: email,
      name: `${PROJECT_NAME} In Person`,
    },
    replyTo: email,
    templateId: SENDGRID_ERROR_EMAIL_TEMPLATE_ID,
    dynamic_template_data: {
      environment: ENVIRONMENT,
      errorMessage: `Error in ${zambda}.\n${error}.\nError stringified: ${JSON.stringify(error)}`,
      timestamp: DateTime.now().setZone('UTC').toFormat("EEEE, MMMM d, yyyy 'at' h:mm a ZZZZ"),
    },
  };

  try {
    const sendResult = await sendgrid.send(emailConfiguration);
    console.log(
      `Details of successful sendgrid send: statusCode, ${sendResult[0].statusCode}. body, ${JSON.stringify(
        sendResult[0].body
      )}`
    );
  } catch (error) {
    console.error(`Error sending email to ${email}: ${JSON.stringify(error)}`);
    // // Re-throw error so caller knows we failed.
    // // commenting out because this is causing caught errors to fail and we do not have sendgrid configured yet
    // // adding todo fix this after configuring sendgrid secrets
    // throw error;
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
