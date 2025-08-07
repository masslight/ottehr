import Oystehr, { TransactionalSMSSendParams } from '@oystehr/sdk';
import sendgrid from '@sendgrid/mail';
import { Appointment, Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  createOystehrClient,
  DATETIME_FULL_NO_YEAR,
  getAddressString,
  getSecret,
  PROJECT_NAME,
  ScheduleOwnerFhirResource,
  Secrets,
  SecretsKeys,
  SLUG_SYSTEM,
} from 'utils';
import { BRANDING_CONFIG } from 'utils/lib/configuration/branding';
import { EmailTemplate, SENDGRID_CONFIG, SendgridConfig } from 'utils/lib/configuration/sendgrid';
import { getNameForOwner } from '../ehr/schedules/shared';
import { sendErrors } from './errors';
import { getRelatedPersonForPatient } from './patients';

export interface VirtualCancellationEmailSettings {
  toAddress: string;
}

export interface InPersonConfirmationEmailSettings extends BaseAppointmentEmailSettings {
  startTime: DateTime;
  appointmentID: string;
}

export interface InPersonReminderEmailSettings extends BaseAppointmentEmailSettings {
  startTime: DateTime;
  appointmentID: string;
}

export interface InPersonCancellationEmailSettings extends BaseAppointmentEmailSettings {
  startTime: DateTime;
}

export interface InPersonCompletionEmailSettings extends BaseAppointmentEmailSettings {
  startTime: DateTime;
  visitNoteUrl: string;
}

export interface VirtualConfirmationEmailSettings extends BaseAppointmentEmailSettings {
  appointmentID: string;
}

export interface VirtualCompletionEmailSettings extends BaseAppointmentEmailSettings {
  visitNoteUrl: string;
}
export interface BaseAppointmentEmailSettings {
  email: string;
  scheduleResource: ScheduleOwnerFhirResource;
}
export interface VideoChatInvitationEmailInput {
  email: string;
  inviteUrl: string;
  patientName: string;
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

interface SendInPersonMessagesInput {
  email: string | undefined;
  firstName: string | undefined;
  messageRecipient: string;
  startTime: DateTime;
  secrets: Secrets | null;
  scheduleResource: ScheduleOwnerFhirResource;
  appointmentID: string;
  appointmentType: string;
  language: string;
  token: string;
}
export async function sendInPersonMessages({
  email,
  firstName,
  messageRecipient,
  startTime,
  secrets,
  scheduleResource,
  appointmentID,
  appointmentType,
  language,
  token,
}: SendInPersonMessagesInput): Promise<void> {
  const start = DateTime.now();
  if (email) {
    const emailClient = getEmailClient(secrets);
    await emailClient.sendInPersonConfirmationEmail({
      email,
      startTime,
      appointmentID,
      scheduleResource,
      // TODO bring back when supporting spanish emails
      // language,
    });
  } else {
    console.log('email undefined');
  }
  const WEBSITE_URL = getSecret(SecretsKeys.WEBSITE_URL, secrets);
  const messageAll = `Your check-in time for ${firstName} at ${getNameForOwner(
    scheduleResource
  )} is ${startTime}. Please save time at check-in by completing your pre-visit paperwork`;
  const message =
    appointmentType === 'walkin' || appointmentType === 'posttelemed'
      ? `${messageAll}: ${WEBSITE_URL}/paperwork/${appointmentID}`
      : `You're confirmed! ${messageAll}, or modify/cancel your visit: ${WEBSITE_URL}/visit/${appointmentID}`;
  // cSpell:disable-next spanish
  const messageAllSpanish = `¡Gracias por elegir ${PROJECT_NAME} In Person! Su hora de registro para ${firstName} en ${scheduleResource.name} es el día ${startTime}. Nuestra nueva tecnología requiere que los pacientes nuevos Y los recurrentes completen los formularios y se aseguren de que los registros estén actualizados. Para expediar el proceso, antes de su llegada por favor llene el papeleo`;
  const messageSpanish =
    appointmentType === 'walkin' || appointmentType === 'posttelemed'
      ? `${messageAllSpanish}: ${WEBSITE_URL}/paperwork/${appointmentID}`
      : // cSpell:disable-next spanish
        `¡Está confirmado! ${messageAllSpanish}. Para completar la documentación o modificar/cancelar su registro, visite: ${WEBSITE_URL}/visit/${appointmentID}`;

  const oystehr = createOystehrClient(
    token,
    getSecret(SecretsKeys.FHIR_API, secrets),
    getSecret(SecretsKeys.PROJECT_API, secrets)
  );

  let selectedMessage;
  switch (language?.split('-')?.[0] ?? 'en') {
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
    const commId = await oystehr.transactionalSMS.send({
      message: selectedMessage,
      resource: messageRecipient,
    });
    console.log('message send successful', commId);
  } catch (e) {
    console.log('message send error: ', JSON.stringify(e));
    void sendErrors(e, getSecret(SecretsKeys.ENVIRONMENT, secrets));
  } finally {
    const end = DateTime.now();
    const messagesExecutionTime = end.toMillis() - start.toMillis();
    console.log(`sending messages took ${messagesExecutionTime} ms`);
  }
}

class EmailClient {
  private config: SendgridConfig;
  private secrets: Secrets | null;

  constructor(config: SendgridConfig, secrets: Secrets | null) {
    this.config = config;
    this.secrets = secrets;
    const SENDGRID_API_KEY = getSecret(SecretsKeys.SENDGRID_API_KEY, secrets);
    if (!SENDGRID_API_KEY) {
      throw new Error('SendGrid API key is not set in secrets');
    }
    sendgrid.setApiKey(SENDGRID_API_KEY);
  }

  private async sendEmail(to: string, template: EmailTemplate, templateInformation: any): Promise<void> {
    const { templateIdSecretName, subject: templateSubject } = template;
    const SENDGRID_EMAIL_BCC = this.config.bcc;
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, this.secrets);
    const environmentSubjectPrepend = ENVIRONMENT === 'production' ? '' : `[${ENVIRONMENT}] `;
    const subject = `${environmentSubjectPrepend}${templateSubject}`;
    const templateId = getSecret(templateIdSecretName, this.secrets);

    const from = this.config.from;
    const replyTo = this.config.replyTo;

    const { email, projectName, projectDomain } = BRANDING_CONFIG;

    const emailConfiguration = {
      to,
      from,
      bcc: SENDGRID_EMAIL_BCC,
      replyTo,
      templateId,
      dynamic_template_data: {
        subject,
        ...templateInformation,
        branding: {
          email,
          projectName,
          projectDomain,
        },
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
      const errorMessage = `Error sending email with subject ${subject} to ${to}`;
      console.error(`${errorMessage}: ${error}`);
      void sendErrors(errorMessage, ENVIRONMENT);
    }
  }

  async sendVirtualConfirmationEmail(input: VirtualConfirmationEmailSettings): Promise<void> {
    const { email, appointmentID } = input;
    const WEBSITE_URL = getSecret(SecretsKeys.WEBSITE_URL, this.secrets);

    // Translation variables
    const templateInformation = {
      url: `${WEBSITE_URL}/waiting-room?appointment_id=${appointmentID}`,
    };
    await this.sendEmail(email, this.config.templates.telemedConfirmation, templateInformation);
  }

  async sendVirtualCancelationEmail(input: VirtualCancellationEmailSettings): Promise<void> {
    const { toAddress } = input;
    const WEBSITE_URL = getSecret(SecretsKeys.WEBSITE_URL, this.secrets);

    const templateInformation = {
      url: `${WEBSITE_URL}/welcome`,
    };
    await this.sendEmail(toAddress, this.config.templates.telemedCancelation, templateInformation);
  }

  async sendVirtualCompletionEmail(input: VirtualCompletionEmailSettings): Promise<void> {
    const { email, scheduleResource, visitNoteUrl } = input;

    const templateInformation = {
      location: getNameForOwner(scheduleResource),
      'visit-note-url': visitNoteUrl,
    };
    await this.sendEmail(email, this.config.templates.telemedCompletion, templateInformation);
    // unsubscribeGroupId: sendGridUnsubscribeGroupIds.telemed.completion,
  }

  async sendVideoChatInvitationEmail(input: VideoChatInvitationEmailInput): Promise<void> {
    const { email, inviteUrl, patientName } = input;
    const templateInformation = {
      inviteUrl: inviteUrl,
      patientName: patientName,
    };
    await this.sendEmail(email, this.config.templates.telemedInvitation, templateInformation);
  }

  async sendInPersonConfirmationEmail(input: InPersonConfirmationEmailSettings): Promise<void> {
    const { email, startTime, appointmentID, scheduleResource } = input;
    const WEBSITE_URL = getSecret(SecretsKeys.WEBSITE_URL, this.secrets);
    // const SENDGRID_SPANISH_CONFIRMATION_EMAIL_TEMPLATE_ID = getSecret(
    //   SecretsKeys.IN_PERSON_SENDGRID_SPANISH_CONFIRMATION_EMAIL_TEMPLATE_ID,
    //   secrets
    // );

    const readableTime = startTime.toFormat(DATETIME_FULL_NO_YEAR);

    // todo handle these when scheduleResource is a healthcare service or a practitioner
    let address: string | undefined;
    let state: string | undefined;
    if (scheduleResource.resourceType === 'Location') {
      address = getAddressString(scheduleResource.address);
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
      time: readableTime,
      datetime: startTime,
      location: scheduleResource.name,
      address,
      'address-url': `https://www.google.com/maps/search/?api=1&query=${encodeURI(address || '')}`,
      'modify-visit-url': rescheduleUrl,
      'cancel-visit-url': `${WEBSITE_URL}/visit/${appointmentID}/cancel`,
      'paperwork-url': `${WEBSITE_URL}/paperwork/${appointmentID}`,
    };
    await this.sendEmail(email, this.config.templates.inPersonConfirmation, templateInformation);
  }
  async sendInPersonCancelationEmail(input: InPersonCancellationEmailSettings): Promise<void> {
    const { email, /* language, */ startTime, scheduleResource } = input;
    const WEBSITE_URL = getSecret(SecretsKeys.WEBSITE_URL, this.secrets);
    const readableTime = startTime.toFormat(DATETIME_FULL_NO_YEAR);

    let address: string | undefined;
    if (scheduleResource.resourceType === 'Location') {
      address = getAddressString(scheduleResource.address);
    }

    const templateInformation = {
      time: readableTime,
      datetime: startTime,
      location: scheduleResource.name,
      address,
      'address-url': `https://www.google.com/maps/search/?api=1&query=${encodeURI(address || '')}`,
      'book-again-url': `${WEBSITE_URL}/home`,
    };
    await this.sendEmail(email, this.config.templates.inPersonCancelation, templateInformation);
  }
  async sendInPersonCompletionEmail(input: InPersonCompletionEmailSettings): Promise<void> {
    const { email, startTime, scheduleResource, visitNoteUrl } = input;
    const readableTime = startTime.toFormat(DATETIME_FULL_NO_YEAR);

    let address: string | undefined;
    if (scheduleResource.resourceType === 'Location') {
      address = getAddressString(scheduleResource.address);
    }

    const templateInformation = {
      time: readableTime,
      datetime: startTime,
      location: scheduleResource.name,
      address,
      'address-url': `https://www.google.com/maps/search/?api=1&query=${encodeURI(address || '')}`,
      'visit-note-url': visitNoteUrl,
    };
    await this.sendEmail(email, this.config.templates.inPersonCompletion, templateInformation);
    //  unsubscribeGroupId: sendGridUnsubscribeGroupIds.inPerson.completion,
  }

  async sendInPersonReminderEmail(input: InPersonReminderEmailSettings): Promise<void> {
    const { email, startTime, appointmentID, scheduleResource } = input;
    const WEBSITE_URL = getSecret(SecretsKeys.WEBSITE_URL, this.secrets);

    const readableTime = startTime.toFormat(DATETIME_FULL_NO_YEAR);
    // todo handle these when scheduleResource is a healthcare service or a practitioner
    let address: string | undefined;
    let state: string | undefined;
    if (scheduleResource.resourceType === 'Location') {
      address = getAddressString(scheduleResource.address);
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
      time: readableTime,
      datetime: startTime,
      location: scheduleResource.name,
      address,
      'address-url': `https://www.google.com/maps/search/?api=1&query=${encodeURI(address || '')}`,
      'modify-visit-url': rescheduleUrl,
      'cancel-visit-url': `${WEBSITE_URL}/visit/${appointmentID}/cancel`,
      'paperwork-url': `${WEBSITE_URL}/paperwork/${appointmentID}`,
    };
    await this.sendEmail(email, this.config.templates.inPersonReminder, templateInformation);
    //unsubscribeGroupId: sendGridUnsubscribeGroupIds.inPerson.reminder,
  }
}

export const getEmailClient = (secrets: Secrets | null): EmailClient => {
  return new EmailClient(SENDGRID_CONFIG, secrets);
};

export async function sendSms(
  message: string,
  resourceReference: string,
  oystehr: Oystehr,
  ENVIRONMENT: string
): Promise<void> {
  try {
    const commId = await oystehr.transactionalSMS.send({
      message,
      resource: resourceReference,
    });
    console.log('message send res: ', commId);
  } catch (e) {
    console.log('message send error: ', JSON.stringify(e));
    void sendErrors(e, ENVIRONMENT);
  }
}

export async function sendSmsForPatient(
  message: string,
  oystehr: Oystehr,
  patient: Patient | undefined,
  ENVIRONMENT: string
): Promise<void> {
  if (!patient) {
    console.error("Message didn't send because no patient was found for encounter");
    return;
  }
  const relatedPerson = await getRelatedPersonForPatient(patient.id!, oystehr);
  if (!relatedPerson) {
    console.error("Message didn't send because no related person was found for this patient, patientId: " + patient.id);
    return;
  }
  const recipient = `RelatedPerson/${relatedPerson.id}`;
  await sendSms(message, recipient, oystehr, ENVIRONMENT);
}
