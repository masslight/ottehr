import sendgrid from '@sendgrid/mail';
import { Secrets, SecretsKeys, getSecret, createMessagingClient, getOptionalSecret } from 'ottehr-utils';
import i18n from './i18n';
import { HealthcareService, Location, Practitioner } from 'fhir/r4';

export interface ConfirmationEmailInput {
  email: string;
  firstName: string | undefined;
  startTime: string;
  appointmentID: string;
  secrets: Secrets | null;
  location: Location;
  appointmentType: string;
}

export const sendConfirmationEmail = async (input: ConfirmationEmailInput): Promise<void> => {
  const { email, firstName, startTime, appointmentID, secrets, location, appointmentType } = input;
  const WEBSITE_URL = getSecret(SecretsKeys.WEBSITE_URL, secrets);
  const SENDGRID_CONFIRMATION_EMAIL_TEMPLATE_ID = getSecret(
    SecretsKeys.TELEMED_SENDGRID_CONFIRMATION_EMAIL_TEMPLATE_ID,
    secrets,
  );

  const subject = i18n.t('appointment.email.confirmation');
  const templateId = SENDGRID_CONFIRMATION_EMAIL_TEMPLATE_ID;
  const templateInformation = {
    firstName,
    startTime,
    locationName: location.name,
    appointmentType,
    paperworkUrl: `${WEBSITE_URL}/paperwork/${appointmentID}`,
    checkInUrl: `${WEBSITE_URL}/waiting-room?appointment_id=${appointmentID}`,
  };
  await sendEmail(email, templateId, subject, templateInformation, secrets);
};

export interface CancellationEmail {
  email: string;
  firstName: string | undefined;
  startTime: string;
  secrets: Secrets | null;
  resource: Location | Practitioner | HealthcareService;
  resourceUrl: string;
}

export const sendCancellationEmail = async (input: CancellationEmail): Promise<void> => {
  const { email, firstName, startTime, secrets, resource, resourceUrl } = input;
  const SENDGRID_CANCELLATION_EMAIL_TEMPLATE_ID = getSecret(
    SecretsKeys.TELEMED_SENDGRID_CANCELLATION_EMAIL_TEMPLATE_ID,
    secrets,
  );

  const subject = i18n.t('appointment.email.cancellation');
  const templateId = SENDGRID_CANCELLATION_EMAIL_TEMPLATE_ID;
  const templateInformation = {
    firstName,
    resourceName: resource.name,
    startTime,
    resourceUrl,
  };
  await sendEmail(email, templateId, subject, templateInformation, secrets);
};

export interface VideoChatInvitationEmailInput {
  email: string;
  inviteUrl: string;
  patientName: string;
  secrets: Secrets | null;
}

export const sendVideoChatInvitationEmail = async (input: VideoChatInvitationEmailInput): Promise<void> => {
  const { email, inviteUrl, patientName, secrets } = input;
  const SENDGRID_VIDEO_CHAT_INVITATION_EMAIL_TEMPLATE_ID = getSecret(
    SecretsKeys.TELEMED_SENDGRID_VIDEO_CHAT_INVITATION_EMAIL_TEMPLATE_ID,
    secrets,
  );
  const subject = i18n.t('appointment.email.invitation');
  const templateId = SENDGRID_VIDEO_CHAT_INVITATION_EMAIL_TEMPLATE_ID;
  const templateInformation = {
    inviteUrl,
    patientName,
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
  const TELEMED_SENDGRID_EMAIL_FROM = getOptionalSecret(
    SecretsKeys.TELEMED_SENDGRID_EMAIL_FROM,
    secrets,
    'no-reply@ottehr.com',
  );
  const TELEMED_SENDGRID_EMAIL_FROM_NAME = getOptionalSecret(
    SecretsKeys.TELEMED_SENDGRID_EMAIL_FROM_NAME,
    secrets,
    'Ottehr Urgent Care',
  );
  const SENDGRID_EMAIL_BCC = getSecret(SecretsKeys.TELEMED_SENDGRID_EMAIL_BCC, secrets).split(',');
  const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, secrets);
  const environmentSubjectPrepend = ENVIRONMENT === 'production' ? '' : `[${ENVIRONMENT}] `;
  subject = `${environmentSubjectPrepend}${subject}`;

  const emailConfiguration = {
    to: email,
    from: {
      email: TELEMED_SENDGRID_EMAIL_FROM,
      name: TELEMED_SENDGRID_EMAIL_FROM_NAME,
    },
    bcc: SENDGRID_EMAIL_BCC,
    replyTo: TELEMED_SENDGRID_EMAIL_FROM,
    templateId: templateID,
    dynamicTemplateData: {
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
    await sendConfirmationEmail({
      email,
      firstName,
      startTime,
      appointmentID,
      secrets,
      location,
      appointmentType,
    });
  } else {
    console.log('email undefined');
  }

  const WEBSITE_URL = getSecret(SecretsKeys.WEBSITE_URL, secrets);
  let message = i18n.t('appointment.sms.confirmation', {
    firstName,
    locationName: location.name,
    startTime,
    paperworkUrl: `${WEBSITE_URL}/paperwork/${appointmentID}`,
    interpolation: { escapeValue: false },
  });
  if (appointmentType === 'walkin') {
    message = `${message} ${i18n.t('appointment.sms.modify', {
      checkInUrl: `${WEBSITE_URL}/visit/${appointmentID}`,
      interpolation: { escapeValue: false },
    })}`;
  }
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
