// picturing bigger and better things for this file but this is a start

import { DateTime } from 'luxon';
import sendgrid from '@sendgrid/mail';
import { Secrets } from '../types';
import { getSecret, SecretsKeys } from './secrets';

export const AMBIGUOUS_PATIENT = 'Patient could not be unambiguously resolved in FHIR DB.';
export const INVALID_PARTICIPANT = 'Invalid participant.';

export async function topLevelCatch(zambda: string, error: any, secrets: Secrets | null): Promise<void> {
  console.error(`Top level catch block in ${zambda}: \n ${error} \n Error stringified: ${JSON.stringify(error)}`);
  await sendErrorEmail(zambda, error, secrets);
}

const sendErrorEmail = async (zambda: string, error: any, secrets: Secrets | null): Promise<void> => {
  const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, secrets);
  // Only fires in staging and production
  if (!['staging', 'production'].includes(ENVIRONMENT)) {
    return;
  }

  const SENDGRID_API_KEY = getSecret(SecretsKeys.SENDGRID_API_KEY, secrets);
  const SENDGRID_ERROR_EMAIL_TEMPLATE_ID = getSecret(SecretsKeys.OTTEHR_SENDGRID_ERROR_EMAIL_TEMPLATE_ID, secrets);

  console.log('Sending error email');
  sendgrid.setApiKey(SENDGRID_API_KEY);

  // TODO confirm details
  const email = 'support@zapehr.com';
  const emailConfiguration = {
    to: email,
    from: {
      email: email,
      name: 'ottEHR',
    },
    replyTo: email,
    templateId: SENDGRID_ERROR_EMAIL_TEMPLATE_ID,
    dynamic_template_data: {
      environment: ENVIRONMENT,
      errorMessage: `Error in ${zambda}.\n${error}.\nError stringified: ${JSON.stringify(error)}`,
      timestamp: DateTime.now().toFormat("EEEE, MMMM d, yyyy 'at' h:mm a ZZZZ"),
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
