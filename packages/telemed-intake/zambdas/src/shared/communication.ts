import sendgrid from '@sendgrid/mail';
import { Secrets, SecretsKeys, getSecret, createMessagingClient } from 'ottehr-utils';
import { Location } from 'fhir/r4';

export interface ConfirmationEmailInput {
  toAddress: string;
  appointmentID: string;
  secrets: Secrets | null;
}

export const sendConfirmationEmail = async (input: ConfirmationEmailInput): Promise<void> => {
  const { toAddress, appointmentID, secrets } = input;
  const WEBSITE_URL = getSecret(SecretsKeys.WEBSITE_URL, secrets);
  const SENDGRID_CONFIRMATION_EMAIL_TEMPLATE_ID = getSecret(
    SecretsKeys.TELEMED_SENDGRID_CONFIRMATION_EMAIL_TEMPLATE_ID,
    secrets,
  );

  // Translation variables
  const subject = 'Ottehr Telemedicine';
  const templateId = SENDGRID_CONFIRMATION_EMAIL_TEMPLATE_ID;
  const templateInformation = {
    url: `${WEBSITE_URL}/waiting-room?appointment_id=${appointmentID}`,
  };
  await sendEmail(toAddress, templateId, subject, templateInformation, secrets);
};

export interface CancellationEmail {
  toAddress: string;
  secrets: Secrets | null;
}

export const sendCancellationEmail = async (input: CancellationEmail): Promise<void> => {
  const { toAddress, secrets } = input;
  const WEBSITE_URL = getSecret(SecretsKeys.WEBSITE_URL, secrets);
  const SENDGRID_CANCELLATION_EMAIL_TEMPLATE_ID = getSecret(
    SecretsKeys.TELEMED_SENDGRID_CANCELLATION_EMAIL_TEMPLATE_ID,
    secrets,
  );
  const subject = 'Ottehr Telemedicine';
  const templateId = SENDGRID_CANCELLATION_EMAIL_TEMPLATE_ID;

  const templateInformation = {
    url: `${WEBSITE_URL}/welcome`,
  };
  await sendEmail(toAddress, templateId, subject, templateInformation, secrets);
};

export interface VideoChatInvitationEmailInput {
  toAddress: string;
  inviteUrl: string;
  patientName: string;
  secrets: Secrets | null;
}

export const sendVideoChatInvititationEmail = async (input: VideoChatInvitationEmailInput): Promise<void> => {
  const { toAddress, inviteUrl, patientName, secrets } = input;
  const SENDGRID_VIDEO_CHAT_INVITATION_EMAIL_TEMPLATE_ID = getSecret(
    SecretsKeys.TELEMED_SENDGRID_VIDEO_CHAT_INVITATION_EMAIL_TEMPLATE_ID,
    secrets,
  );
  const subject = 'Invitation to Join a Visit - Ottehr Telemedicine';
  const templateId = SENDGRID_VIDEO_CHAT_INVITATION_EMAIL_TEMPLATE_ID;
  const templateInformation = {
    inviteUrl: inviteUrl,
    patientName: patientName,
  };
  await sendEmail(toAddress, templateId, subject, templateInformation, secrets);
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
      name: 'Ottehr Urgent Care',
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

export async function sendConfirmationMessages(
  email: string | undefined,
  firstName: string | undefined,
  messageRecipient: string,
  startTime: string,
  secrets: Secrets | null,
  location: Location,
  appointmentID: string,
  appointmentType: string,
  verifiedPhoneNumber: string | undefined,
  token: string,
): Promise<void> {
  if (email) {
    await sendConfirmationEmail({ toAddress: email, appointmentID, secrets });
  } else {
    console.log('email undefined');
  }

  const WEBSITE_URL = getSecret(SecretsKeys.WEBSITE_URL, secrets);
  const message = `You're confirmed! Thanks for choosing Ottehr! Your check-in time for ${firstName} at ${
    location.name
  } is on ${startTime}. Please complete your paperwork in advance to save time at check-in. To complete paperwork visit: ${WEBSITE_URL}/paperwork/${appointmentID}. ${
    appointmentType === 'walkin' ? '' : ` To modify/cancel your check-in, visit: ${WEBSITE_URL}/visit/${appointmentID}`
  }`;
  await sendSms(message, token, messageRecipient, verifiedPhoneNumber, secrets);
}

export async function sendSms(
  message: string,
  token: string,
  messageRecipient: string,
  verifiedPhoneNumber: string | undefined,
  secrets: Secrets | null,
): Promise<void> {
  const messagingClient = createMessagingClient(token, getSecret(SecretsKeys.PROJECT_API, secrets));
  try {
    const commid = await messagingClient.sendSMS({
      message,
      resource: messageRecipient,
      phoneNumber: verifiedPhoneNumber ?? '',
    });
    console.log('message send res: ', commid);
  } catch (e) {
    console.log('message send error: ', JSON.stringify(e));
  }
}
