import { DateTime } from 'luxon';
import { Secrets } from '../types';
import { SecretsKeys, getSecret } from './secrets';
import sendgrid from '@sendgrid/mail';

export async function topLevelCatch(zambda: string, error: any, secrets: Secrets | null): Promise<void> {
  console.error(`Top level catch block in ${zambda}: \n ${error} \n Error stringified: ${JSON.stringify(error)}`);

  const notificationParametesConfigured = !!getSecret(SecretsKeys.SLACK_CHANNEL_HOOK_URL, secrets);
  if (notificationParametesConfigured) {
    await sendErrors(zambda, error, secrets);
  }
}

const sendErrors = async (zambda: string, error: any, secrets: Secrets | null): Promise<void> => {
  const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, secrets);
  // Only fires in staging and production
  if (!['staging', 'production'].includes(ENVIRONMENT)) {
    return;
  }

  const SLACK_CHANNEL_HOOK_URL = getSecret(SecretsKeys.SLACK_CHANNEL_HOOK_URL, secrets);
  const SENDGRID_API_KEY = getSecret(SecretsKeys.SENDGRID_API_KEY, secrets);
  const SENDGRID_ERROR_EMAIL_TEMPLATE_ID = getSecret(SecretsKeys.SENDGRID_ERROR_EMAIL_TEMPLATE_ID, secrets);
  const SENDGRID_EMAIL = getSecret(SecretsKeys.SENDGRID_EMAIL, secrets);

  console.log('Sending error message to Slack');
  const notification = 'Top level catch:';
  await fetch(SLACK_CHANNEL_HOOK_URL, {
    method: 'POST',
    body: JSON.stringify({
      text: `${notification} Alert in ${ENVIRONMENT} zambda ${zambda}.\n\n${error}\n\n${JSON.stringify(error)}`,
      link_names: true,
    }),
  });

  console.log('Sending error email');
  sendgrid.setApiKey(SENDGRID_API_KEY);

  const emailConfiguration = {
    to: SENDGRID_EMAIL,
    from: {
      email: SENDGRID_EMAIL,
      name: 'Top level catch',
    },
    replyTo: SENDGRID_EMAIL,
    templateId: SENDGRID_ERROR_EMAIL_TEMPLATE_ID,
    dynamic_template_data: {
      environment: ENVIRONMENT,
      errorMessage: `Error in ${zambda}.\n${error}.\nError stringified: ${JSON.stringify(error)}`,
      timestamp: DateTime.now().setZone('UTC').toFormat("EEEE, MMMM d, yyyy 'at' h:mm a ZZZZ"),
    },
  };

  if (!SENDGRID_EMAIL || !SENDGRID_API_KEY || !SENDGRID_ERROR_EMAIL_TEMPLATE_ID) {
    return;
  }

  try {
    const sendResult = await sendgrid.send(emailConfiguration);
    console.log(
      `Details of successful sendgrid send: statusCode, ${sendResult[0].statusCode}. body, ${JSON.stringify(
        sendResult[0].body,
      )}`,
    );
  } catch (error) {
    console.error(`Error sending email to ${SENDGRID_EMAIL}: ${JSON.stringify(error)}`);
    // Re-throw error so caller knows we failed.
    throw error;
  }
};
