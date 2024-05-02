import sendgrid from '@sendgrid/mail';
import { Location } from 'fhir/r4';
import { Secrets, getSecret, SecretsKeys } from 'ottehr-utils';
import { Client as TwilioClient } from '@twilio/conversations';

export interface ConfirmationEmailInput {
  email: string;
  startTime: string;
  appointmentID: string;
  secrets: Secrets | null;
  location: Location;
}

export const sendConfirmationEmail = async (input: ConfirmationEmailInput): Promise<void> => {
  const { email, startTime, appointmentID, secrets, location } = input;
  const WEBSITE_URL = getSecret(SecretsKeys.WEBSITE_URL, secrets);
  const SENDGRID_CONFIRMATION_EMAIL_TEMPLATE_ID = getSecret(
    SecretsKeys.TELEMED_SENDGRID_CONFIRMATION_EMAIL_TEMPLATE_ID,
    secrets,
  );

  // Translation variables
  const subject = 'Your visit confirmation at Ottehr Telemedicine';
  const templateId = SENDGRID_CONFIRMATION_EMAIL_TEMPLATE_ID;
  const address = `${location?.address?.line?.[0]}${
    location?.address?.line?.[1] ? `,&nbsp;${location.address.line[1]}` : ''
  } `;
  const phone = location.telecom?.find((el) => el.system === 'phone')?.value;
  const templateInformation = {
    appointmentTime: startTime,
    locationName: location.name,
    locationAddress: address,
    locationPhone: phone,
    paperworkUrl: `${WEBSITE_URL}/appointment/${appointmentID}`,
    rescheduleUrl: `${WEBSITE_URL}/appointment/${appointmentID}`,
    cancelUrl: `${WEBSITE_URL}/appointment/${appointmentID}/cancellation-reason`,
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
    SecretsKeys.TELEMED_SENDGRID_CANCELLATION_EMAIL_TEMPLATE_ID,
    secrets,
  );
  const subject = 'Urgent Care: Your Visit Has Been Canceled';
  const templateId = SENDGRID_CANCELLATION_EMAIL_TEMPLATE_ID;
  const address = `${location?.address?.line?.[0]}${
    location?.address?.line?.[1] ? `,&nbsp;${location.address.line[1]}` : ''
  } `;
  const phone = location.telecom?.find((el) => el.system === 'phone')?.value;
  const slug =
    location.identifier?.find((identifierTemp) => identifierTemp.system === 'https://fhir.ottehr.com/r4/slug')?.value ||
    'Unknown';

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
  const SENDGRID_EMAIL_BCC = getSecret(SecretsKeys.TELEMED_SENDGRID_EMAIL_BCC, secrets).split(',');
  const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, secrets);
  const environmentSubjectPrepend = ENVIRONMENT === 'production' ? '' : `[${ENVIRONMENT}] `;
  subject = `${environmentSubjectPrepend}${subject}`;

  const emailConfiguration = {
    to: email,
    from: {
      email: 'no-reply@ottehr.com',
      name: 'Ottehr',
    },
    bcc: SENDGRID_EMAIL_BCC,
    replyTo: 'no-reply@ottehr.com',
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
  const twilioTokenRequest = await fetch(`${PROJECT_API_URL}/messaging/conversation/token`, {
    headers: {
      Authorization: `Bearer ${zapehrMessagingToken}`,
    },
  });
  const twilioTokenResponse = await twilioTokenRequest.json();
  const twilioToken = twilioTokenResponse.token;
  const twilioClient = new TwilioClient(twilioToken);
  const messagingDeviceSenderID = getSecret(SecretsKeys.TELEMED_MESSAGING_DEVICE_ID, secrets);
  console.log(twilioToken);
  await twilioClientSendMessage(twilioClient, conversationSID, message, messagingDeviceSenderID);
  console.log('Response from the promise');
}

async function twilioClientSendMessage(
  twilioClient: TwilioClient,
  conversationSID: string,
  message: string,
  messagingDeviceSenderID: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      twilioClient.on('initialized', async () => {
        const twilioConversation = await twilioClient.getConversationBySid(conversationSID);
        const messageRequest = await twilioConversation.sendMessage(message, {
          senderName: 'Intake Message',
          senderID: messagingDeviceSenderID,
        });
        // if the most recently sent message was read mark all messages as read
        console.log(twilioConversation.lastReadMessageIndex, twilioConversation.lastMessage?.index);
        if (twilioConversation.lastReadMessageIndex === twilioConversation.lastMessage?.index) {
          await twilioConversation.setAllMessagesRead();
        }
        console.log(`Message sent ${messageRequest}`);
        await twilioClient.shutdown();
        resolve();
      });
    } catch (error) {
      console.log('Error sending twilio message', error);
      reject(error);
    }
  });
}
