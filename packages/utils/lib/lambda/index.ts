import { DateTime } from 'luxon';
import sendgrid from '@sendgrid/mail';
import { Secrets, getSecret, SecretsKeys } from '../secrets';

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
  const notification = 'todo';
  const url =
    ENVIRONMENT === 'production'
      ? 'https://hooks.slack.com/services/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'
      : 'https://hooks.slack.com/services/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';
  await fetch(url, {
    method: 'POST',
    body: JSON.stringify({
      text: `${notification} Alert in ${ENVIRONMENT} zambda ${zambda}.\n\n${error}\n\n${JSON.stringify(error)}`,
      link_names: true,
    }),
  });

  const SENDGRID_API_KEY = getSecret(SecretsKeys.SENDGRID_API_KEY, secrets);
  const SENDGRID_ERROR_EMAIL_TEMPLATE_ID = getSecret(SecretsKeys.URGENT_CARE_SENDGRID_ERROR_EMAIL_TEMPLATE_ID, secrets);

  console.log('Sending error email');
  sendgrid.setApiKey(SENDGRID_API_KEY);

  // TODO confirm details
  const email = 'support@masslight.com';
  const emailConfiguration = {
    to: email,
    from: {
      email: email,
      name: 'Ottehr',
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
    // Re-throw error so caller knows we failed.
    throw error;
  }
};
