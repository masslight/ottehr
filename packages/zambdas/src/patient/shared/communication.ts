import Oystehr, { TransactionalSMSSendParams } from '@oystehr/sdk';
import sendgrid from '@sendgrid/mail';
import { Appointment, HealthcareService, Location, Practitioner } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  createOystehrClient,
  formatPhoneNumberDisplay,
  getRelatedPersonForPatient,
  isLocationVirtual,
  ServiceMode,
  SLUG_SYSTEM,
} from 'utils';
import { getSecret, Secrets, SecretsKeys, sendErrors } from 'zambda-utils';

export interface InPersonCancellationEmailSettings {
  email: string;
  startTime: string;
  secrets: Secrets | null;
  language: string;
  scheduleResource: Location | HealthcareService | Practitioner;
  visitType: string;
}

export interface InPersonConfirmationEmailSettings {
  email: string;
  startTime: string;
  appointmentID: string;
  language: string;
  secrets: Secrets | null;
  scheduleResource: Location | HealthcareService | Practitioner;
  appointmentType: string;
}

export interface VirtualConfirmationEmailSettings {
  toAddress: string;
  appointmentID: string;
  secrets: Secrets | null;
}

export interface VirtualCancellationEmailSettings {
  toAddress: string;
  secrets: Secrets | null;
}

export async function getMessageRecipientForAppointment(
  appointment: Appointment,
  oystehr: Oystehr
): Promise<Omit<TransactionalSMSSendParams, 'message'> | undefined> {
  const patientId = appointment?.participant
    .find((participantTemp) => participantTemp.actor?.reference?.startsWith('Patient/'))
    ?.actor?.reference?.replace('Patient/', '');
  const relatedPerson = await getRelatedPersonForPatient(patientId || '', oystehr);
  if (relatedPerson) {
    return {
      resource: `RelatedPerson/${relatedPerson.id}`,
    };
  } else {
    console.log(`No RelatedPerson found for patient ${patientId} not sending text message`);
    return;
  }
}

export const sendInPersonCancellationEmail = async (input: InPersonCancellationEmailSettings): Promise<void> => {
  const { email, language, startTime, secrets, scheduleResource, visitType } = input;
  const WEBSITE_URL = getSecret(SecretsKeys.WEBSITE_URL, secrets);
  const SENDGRID_CANCELLATION_EMAIL_TEMPLATE_ID = getSecret(
    SecretsKeys.IN_PERSON_SENDGRID_CANCELLATION_EMAIL_TEMPLATE_ID,
    secrets
  );
  const SENDGRID_SPANISH_CANCELLATION_EMAIL_TEMPLATE_ID = getSecret(
    SecretsKeys.IN_PERSON_SENDGRID_SPANISH_CANCELLATION_EMAIL_TEMPLATE_ID,
    secrets
  );
  let subject = 'In Person: Your Visit Has Been Canceled';
  let templateId = SENDGRID_CANCELLATION_EMAIL_TEMPLATE_ID;
  let address;
  if (scheduleResource.resourceType === 'Location') {
    address = `${scheduleResource?.address?.line?.[0]}${
      scheduleResource?.address?.line?.[1] ? `, ${scheduleResource.address.line[1]}` : ''
    }, ${scheduleResource?.address?.city}, ${scheduleResource?.address?.state} ${scheduleResource?.address
      ?.postalCode}`;
  }

  // In case of e.g. en-US or en-GB, ignore local dialect
  switch (language.split('-')[0]) {
    case 'es':
      subject = 'In Person: Su consulta ha sido cancelada';
      templateId = SENDGRID_SPANISH_CANCELLATION_EMAIL_TEMPLATE_ID;
      break;
    case 'en':
      subject = 'In Person: Your Visit Has Been Canceled';
      templateId = SENDGRID_CANCELLATION_EMAIL_TEMPLATE_ID;
      break;
    default:
      subject = 'In Person: Your Visit Has Been Canceled';
      templateId = SENDGRID_CANCELLATION_EMAIL_TEMPLATE_ID;
      break;
  }

  const phone = formatPhoneNumberDisplay(scheduleResource.telecom?.find((el) => el.system === 'phone')?.value || '');
  const isVirtual = scheduleResource.resourceType === 'Location' ? isLocationVirtual(scheduleResource) : false;
  const slug =
    scheduleResource.identifier?.find((identifierTemp) => identifierTemp.system === SLUG_SYSTEM)?.value || 'Unknown';

  const templateInformation = {
    appointmentTime: startTime,
    locationName: scheduleResource.name,
    locationAddress: address,
    locationPhone: phone,
    bookAgainUrl: `${WEBSITE_URL}/location/${slug}/${visitType}/${
      isVirtual ? ServiceMode.virtual : ServiceMode['in-person']
    }`,
  };
  await sendEmail(email, templateId, subject, templateInformation, secrets);
};

export async function sendInPersonMessages(
  email: string | undefined,
  firstName: string | undefined,
  messageRecipient: string,
  startTime: string,
  secrets: Secrets | null,
  scheduleResource: Location | HealthcareService | Practitioner,
  appointmentID: string,
  appointmentType: string,
  language: string,
  token: string
): Promise<void> {
  const start = DateTime.now();
  if (email) {
    await sendInPersonConfirmationEmail({
      email,
      startTime,
      appointmentID,
      secrets,
      scheduleResource,
      appointmentType,
      language,
    });
  } else {
    console.log('email undefined');
  }
  const WEBSITE_URL = getSecret(SecretsKeys.WEBSITE_URL, secrets);
  const messageAll = `Your check-in time for ${firstName} at ${scheduleResource.name} is ${startTime}. Please save time at check-in by completing your pre-visit paperwork`;
  const message =
    appointmentType === 'walkin' || appointmentType === 'posttelemed'
      ? `${messageAll}: ${WEBSITE_URL}/paperwork/${appointmentID}`
      : `You're confirmed! ${messageAll}, or modify/cancel your visit: ${WEBSITE_URL}/visit/${appointmentID}`;
  const messageAllSpanish = `¡Gracias por elegir Ottehr In Person! Su hora de registro para ${firstName} en ${scheduleResource.name} es el día ${startTime}. Nuestra nueva tecnología requiere que los pacientes nuevos Y los recurrentes completen los formularios y se aseguren de que los registros estén actualizados. Para expediar el proceso, antes de su llegada por favor llene el papeleo`;
  const messageSpanish =
    appointmentType === 'walkin' || appointmentType === 'posttelemed'
      ? `${messageAllSpanish}: ${WEBSITE_URL}/paperwork/${appointmentID}`
      : `¡Está confirmado! ${messageAllSpanish}. Para completar la documentación o modificar/cancelar su registro, visite: ${WEBSITE_URL}/visit/${appointmentID}`;

  const oystehr = createOystehrClient(
    token,
    getSecret(SecretsKeys.FHIR_API, secrets),
    getSecret(SecretsKeys.PROJECT_API, secrets)
  );

  let selectedMessage;
  switch (language.split('-')[0]) {
    case 'es':
      selectedMessage = messageSpanish;
      break;
    case 'en':
      selectedMessage = message;
      break;
    default:
      selectedMessage = message;
      break;
  }

  try {
    const commid = await oystehr.transactionalSMS.send({
      message: selectedMessage,
      resource: messageRecipient,
    });
    console.log('message send successful', commid);
  } catch (e) {
    console.log('message send error: ', JSON.stringify(e));
  } finally {
    const end = DateTime.now();
    const messagesExecutionTime = end.toMillis() - start.toMillis();
    console.log(`sending messages took ${messagesExecutionTime} ms`);
  }
}

export const sendInPersonConfirmationEmail = async (input: InPersonConfirmationEmailSettings): Promise<void> => {
  const { email, startTime, language, appointmentID, secrets, scheduleResource, appointmentType } = input;
  const WEBSITE_URL = getSecret(SecretsKeys.WEBSITE_URL, secrets);
  const SENDGRID_CONFIRMATION_EMAIL_TEMPLATE_ID = getSecret(
    SecretsKeys.IN_PERSON_SENDGRID_CONFIRMATION_EMAIL_TEMPLATE_ID,
    secrets
  );
  const SENDGRID_SPANISH_CONFIRMATION_EMAIL_TEMPLATE_ID = getSecret(
    SecretsKeys.IN_PERSON_SENDGRID_SPANISH_CONFIRMATION_EMAIL_TEMPLATE_ID,
    secrets
  );

  // Translation variables
  let subject = 'Your visit confirmation at Ottehr';
  let templateId = SENDGRID_CONFIRMATION_EMAIL_TEMPLATE_ID;

  // In case of e.g. en-US or en-GB, ignore local dialect
  switch (language.split('-')[0]) {
    case 'es':
      subject = 'Confirmación de su consulta en Ottehr';
      templateId = SENDGRID_SPANISH_CONFIRMATION_EMAIL_TEMPLATE_ID;
      break;
    case 'en':
      subject = 'Your visit confirmation at Ottehr';
      templateId = SENDGRID_CONFIRMATION_EMAIL_TEMPLATE_ID;
      break;
    default:
      subject = 'Your visit confirmation at Ottehr';
      templateId = SENDGRID_CONFIRMATION_EMAIL_TEMPLATE_ID;
      break;
  }

  // todo handle these when scheduleResource is a healthcare service or a practitioner
  let address: string | undefined;
  let phone: string | undefined;
  let state: string | undefined;
  if (scheduleResource.resourceType === 'Location') {
    address = `${scheduleResource?.address?.line?.[0]}${
      scheduleResource?.address?.line?.[1] ? `, ${scheduleResource.address.line[1]}` : ''
    }, ${scheduleResource?.address?.city}, ${scheduleResource?.address?.state} ${scheduleResource?.address
      ?.postalCode}`;
    phone = formatPhoneNumberDisplay(scheduleResource?.telecom?.find((el) => el.system === 'phone')?.value || '');
    state = scheduleResource.address?.state;
  }

  // todo: some validation so we're not sending emails with broken links
  const slug =
    scheduleResource.identifier?.find((identifierTemp) => identifierTemp.system === SLUG_SYSTEM)?.value || 'Unknown';
  let rescheduleUrl = `${WEBSITE_URL}/visit/${appointmentID}/reschedule?slug=${slug}`;

  if (state) {
    rescheduleUrl = `${rescheduleUrl}&state=${state}`;
  }
  const templateInformation = {
    appointmentTime: startTime,
    locationName: scheduleResource.name,
    locationAddress: address,
    locationPhone: phone,
    appointmentType: appointmentType,
    paperworkUrl: `${WEBSITE_URL}/paperwork/${appointmentID}`,
    rescheduleUrl,
    cancelUrl: `${WEBSITE_URL}/visit/${appointmentID}/cancel`,
  };
  await sendEmail(email, templateId, subject, templateInformation, secrets);
};

export async function sendEmail(
  email: string,
  templateID: string,
  subject: string,
  templateInformation: any,
  secrets: Secrets | null
): Promise<void> {
  console.log(`Sending email confirmation to ${email}`);
  const SENDGRID_API_KEY = getSecret(SecretsKeys.SENDGRID_API_KEY, secrets);
  if (!(SENDGRID_API_KEY && templateID)) {
    console.error(
      "Email message can't be sent because either Sendgrid api key or message template ID variable was not set"
    );
    return;
  }
  sendgrid.setApiKey(SENDGRID_API_KEY);
  const SENDGRID_EMAIL_BCC = getSecret(SecretsKeys.SENDGRID_EMAIL_BCC, secrets).split(',');
  const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, secrets);
  const environmentSubjectPrepend = ENVIRONMENT === 'production' ? '' : `[${ENVIRONMENT}] `;
  subject = `${environmentSubjectPrepend}${subject}`;

  const emailConfiguration = {
    to: email,
    from: {
      email: 'no-reply@ottehr.com',
      name: 'Ottehr In Person',
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
        sendResult[0].body
      )}`
    );
  } catch (error) {
    const errorMessage = `Error sending email confirmation to ${email}`;
    console.error(`${errorMessage}: ${error}`);
    // Send alert to Slack
    await sendErrors('email', errorMessage, secrets);
  }
}

export const sendVirtualConfirmationEmail = async (input: VirtualConfirmationEmailSettings): Promise<void> => {
  const { toAddress, appointmentID, secrets } = input;
  const WEBSITE_URL = getSecret(SecretsKeys.WEBSITE_URL, secrets);
  const SENDGRID_CONFIRMATION_EMAIL_TEMPLATE_ID = getSecret(
    SecretsKeys.VIRTUAL_SENDGRID_CONFIRMATION_EMAIL_TEMPLATE_ID,
    secrets
  );

  // Translation variables
  const subject = 'Ottehr Telemedicine';
  const templateId = SENDGRID_CONFIRMATION_EMAIL_TEMPLATE_ID;
  const templateInformation = {
    url: `${WEBSITE_URL}/waiting-room?appointment_id=${appointmentID}`,
  };
  await sendEmail(toAddress, templateId, subject, templateInformation, secrets);
};

export const sendVirtualCancellationEmail = async (input: VirtualCancellationEmailSettings): Promise<void> => {
  const { toAddress, secrets } = input;
  const WEBSITE_URL = getSecret(SecretsKeys.WEBSITE_URL, secrets);
  const SENDGRID_CANCELLATION_EMAIL_TEMPLATE_ID = getSecret(
    SecretsKeys.VIRTUAL_SENDGRID_CANCELLATION_EMAIL_TEMPLATE_ID,
    secrets
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
  try {
    const { toAddress, inviteUrl, patientName, secrets } = input;
    const SENDGRID_VIDEO_CHAT_INVITATION_EMAIL_TEMPLATE_ID = getSecret(
      SecretsKeys.VIRTUAL_SENDGRID_VIDEO_CHAT_INVITATION_EMAIL_TEMPLATE_ID,
      secrets
    );
    const subject = 'Invitation to Join a Visit - Ottehr Telemedicine';
    const templateId = SENDGRID_VIDEO_CHAT_INVITATION_EMAIL_TEMPLATE_ID;
    const templateInformation = {
      inviteUrl: inviteUrl,
      patientName: patientName,
    };
    await sendEmail(toAddress, templateId, subject, templateInformation, secrets);
  } catch (e) {
    console.error(`Error sending video chat invitation email: ${e}`);
  }
};

export async function sendConfirmationMessages(
  email: string | undefined,
  message: string,
  messageRecipient: string,
  secrets: Secrets | null,
  appointmentID: string,
  token: string
): Promise<void> {
  const messagePromises: Promise<any>[] = [];
  if (email) {
    messagePromises.push(sendVirtualConfirmationEmail({ toAddress: email, appointmentID, secrets }));
  } else {
    console.log('email undefined');
  }
  messagePromises.push(sendSms(message, token, messageRecipient, secrets));
  await Promise.all(messagePromises).catch((e) =>
    console.error(`Stringified err: ${JSON.stringify(e)}, just error: ${e}`)
  );
}

export async function sendSms(
  message: string,
  token: string,
  messageRecipient: string,
  secrets: Secrets | null
): Promise<void> {
  try {
    const oystehr = createOystehrClient(
      token,
      getSecret(SecretsKeys.FHIR_API, secrets),
      getSecret(SecretsKeys.PROJECT_API, secrets)
    );
    const commid = await oystehr.transactionalSMS.send({
      message,
      resource: messageRecipient,
    });
    console.log('Sms message send res: ', commid);
  } catch (e) {
    console.log('Sms message send error: ', JSON.stringify(e));
  }
}
