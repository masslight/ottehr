import sendgrid from '@sendgrid/mail';
import { Location } from 'fhir/r4';
import { Secrets, SecretsKeys, getSecret, topLevelCatch } from 'utils';

export interface ConfirmationEmailInput {
  email: string;
  startTime: string;
  appointmentID: string;
  secrets: Secrets | null;
  location: Location;
  appointmentType: string;
}

export const sendConfirmationEmail = async (input: ConfirmationEmailInput): Promise<void> => {
  const { email, startTime, appointmentID, secrets, location, appointmentType } = input;
  const WEBSITE_URL = getSecret(SecretsKeys.WEBSITE_URL, secrets);
  const SENDGRID_CONFIRMATION_EMAIL_TEMPLATE_ID = getSecret(
    SecretsKeys.SENDGRID_CONFIRMATION_EMAIL_TEMPLATE_ID,
    secrets,
  );

  // Translation variables
  const subject = 'Your visit confirmation at Ottehr Urgent Care';
  const templateId = SENDGRID_CONFIRMATION_EMAIL_TEMPLATE_ID;
  const address = `${location?.address?.line?.[0]}${
    location?.address?.line?.[1] ? `,&nbsp;${location.address.line[1]}` : ''
  }, ${location?.address?.city}, ${location?.address?.state} ${location?.address?.postalCode}`;
  const phone = location.telecom?.find((el) => el.system === 'phone')?.value;
  const slug =
    location.identifier?.find(
      (identifierTemp) => identifierTemp.system === 'https://fhir.zapehr.com/r4/StructureDefinitions/location',
    )?.value || 'Unknown';
  const templateInformation = {
    appointmentTime: startTime,
    locationName: location.name,
    locationAddress: address,
    locationPhone: phone,
    appointmentType: appointmentType,
    paperworkUrl: `${WEBSITE_URL}/appointment/${appointmentID}`,
    rescheduleUrl: `${WEBSITE_URL}/appointment/${appointmentID}/reschedule?slug=${slug}`,
    cancelUrl: `${WEBSITE_URL}/appointment/${appointmentID}/cancel`,
  };
  await sendEmail(email, templateId, subject, templateInformation, secrets);
};

export interface CancellationEmail {
  email: string;
  startTime: string;
  secrets: Secrets | null;
  location: Location;
  visitType: string;
}

export const sendCancellationEmail = async (input: CancellationEmail): Promise<void> => {
  const { email, startTime, secrets, location, visitType } = input;
  const WEBSITE_URL = getSecret(SecretsKeys.WEBSITE_URL, secrets);
  const SENDGRID_CANCELLATION_EMAIL_TEMPLATE_ID = getSecret(
    SecretsKeys.SENDGRID_CANCELLATION_EMAIL_TEMPLATE_ID,
    secrets,
  );
  const subject = 'Urgent Care: Your Visit Has Been Canceled';
  const templateId = SENDGRID_CANCELLATION_EMAIL_TEMPLATE_ID;
  const address = `${location?.address?.line?.[0]}${
    location?.address?.line?.[1] ? `,&nbsp;${location.address.line[1]}` : ''
  }, ${location?.address?.city}, ${location?.address?.state} ${location?.address?.postalCode}`;
  const phone = location.telecom?.find((el) => el.system === 'phone')?.value;
  const slug =
    location.identifier?.find(
      (identifierTemp) => identifierTemp.system === 'https://fhir.zapehr.com/r4/StructureDefinitions/location',
    )?.value || 'Unknown';

  const templateInformation = {
    appointmentTime: startTime,
    locationName: location.name,
    locationAddress: address,
    locationPhone: phone,
    bookAgainUrl: `${WEBSITE_URL}/location/${slug}/${visitType}`,
  };
  await sendEmail(email, templateId, subject, templateInformation, secrets);
};

async function sendEmail(
  email: string,
  templateID: string,
  subject: string,
  templateInformation: any,
  secrets: Secrets | null,
): Promise<void> {
  console.log(`Sending email confirmation to ${email}`);
  const SENDGRID_API_KEY = getSecret(SecretsKeys.SENDGRID_API_KEY, secrets);
  sendgrid.setApiKey(SENDGRID_API_KEY);
  const SENDGRID_EMAIL = getSecret(SecretsKeys.SENDGRID_EMAIL, secrets).split(',');
  const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, secrets);
  const environmentSubjectPrepend = ENVIRONMENT === 'production' ? '' : `[${ENVIRONMENT}] `;
  subject = `${environmentSubjectPrepend}${subject}`;

  const emailConfiguration = {
    to: email,
    from: {
      email: 'test@ottehr.com',
      name: 'Ottehr Urgent Care',
    },
    bcc: SENDGRID_EMAIL,
    replyTo: 'test@ottehr.com',
    templateId: templateID,
    dynamic_template_data: {
      subject,
      ...templateInformation,
    },
  };

  try {
    const sendResult = await sendgrid.send(emailConfiguration);
    console.log(
      `Details of successful sendgrid send: statusCode, ${sendResult[0].statusCode}. body, ${JSON.stringify(
        sendResult[0].body,
      )}`,
    );
  } catch (error) {
    console.error(`Error sending email confirmation to ${email}: ${error}`);
    // re-throw error so caller knows we failed.
    throw error;
  }
}

export async function sendMessage(
  message: string,
  conversationSID: string,
  zapehrMessagingToken: string,
  secrets: Secrets | null,
): Promise<void> {
  console.log(`Sending message "${message}" to conversation ${conversationSID} using twilio`);
  const PROJECT_API_URL = getSecret(SecretsKeys.PROJECT_API, secrets);

  const messagingDeviceSenderID = getSecret(SecretsKeys.MESSAGING_DEVICE_ID, secrets);

  const attributes = {
    senderName: 'Automated Message',
    senderID: messagingDeviceSenderID,
  };

  try {
    const textResponse = await fetch(`${PROJECT_API_URL}/messaging/conversation/${conversationSID}/message`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${zapehrMessagingToken}`,
      },
      body: JSON.stringify({ message, attributes }),
    });
    if (!textResponse.ok) {
      console.log('error sending text message', await textResponse.json());
      throw new Error('Error sending a text message');
    }
    console.log('Sent a text message status', textResponse.status);
  } catch (error) {
    console.log('Error sending a text message');
    await topLevelCatch('messaging', error, secrets);
  }
}
