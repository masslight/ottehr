import Oystehr, { TransactionalSMSSendParams } from '@oystehr/sdk';
import sendgrid from '@sendgrid/mail';
import { Appointment, Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  createOystehrClient,
  DATETIME_FULL_NO_YEAR,
  DynamicTemplateDataRecord,
  EmailTemplate,
  getAddressStringForScheduleResource,
  getNameFromScheduleResource,
  getSecret,
  PROJECT_NAME,
  ScheduleOwnerFhirResource,
  Secrets,
  SecretsKeys,
  SENDGRID_CONFIG,
  SendgridConfig,
} from 'utils';
import { BRANDING_CONFIG } from 'utils/lib/configuration/branding';
import { getNameForOwner } from '../ehr/schedules/shared';
import { sendErrors } from './errors';
import { getRelatedPersonForPatient } from './patients';

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
    const WEBSITE_URL = getSecret(SecretsKeys.WEBSITE_URL, secrets);
    // const SENDGRID_SPANISH_CONFIRMATION_EMAIL_TEMPLATE_ID = getSecret(
    //   SecretsKeys.IN_PERSON_SENDGRID_SPANISH_CONFIRMATION_EMAIL_TEMPLATE_ID,
    //   secrets
    // );

    const readableTime = startTime.toFormat(DATETIME_FULL_NO_YEAR);

    // todo handle these when scheduleResource is a healthcare service or a practitioner
    const address = getAddressStringForScheduleResource(scheduleResource);
    if (!address) {
      throw new Error('Address is required to send reminder email');
    }
    const location = getNameFromScheduleResource(scheduleResource);
    if (!location) {
      throw new Error('Location is required to send reminder email');
    }

    const rescheduleUrl = `${WEBSITE_URL}/visit/${appointmentID}/reschedule`;
    const templateData = {
      time: readableTime,
      location,
      address,
      'address-url': `https://www.google.com/maps/search/?api=1&query=${encodeURI(address || '')}`,
      'modify-visit-url': rescheduleUrl,
      'cancel-visit-url': `${WEBSITE_URL}/visit/${appointmentID}/cancel`,
      'paperwork-url': `${WEBSITE_URL}/paperwork/${appointmentID}`,
    };
    await emailClient.sendInPersonConfirmationEmail(email, templateData);
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

  private async sendEmail<T extends EmailTemplate>(
    to: string | string[],
    template: T,
    templateData: DynamicTemplateDataRecord<T>
  ): Promise<void> {
    const defaultBCCAndLowersEmail = 'ottehr-support@masslight.com';
    const { templateIdSecretName } = template;
    const SENDGRID_EMAIL_BCC = [defaultBCCAndLowersEmail];
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, this.secrets);
    const environmentSubjectPrepend = ENVIRONMENT === 'production' ? '' : `[${ENVIRONMENT}] `;
    const templateId = getSecret(templateIdSecretName, this.secrets);

    const { email: baseEmail, projectName } = BRANDING_CONFIG;

    const projectDomain = getSecret(SecretsKeys.WEBSITE_URL, this.secrets);

    const {
      supportPhoneNumber: defaultSupportPhoneNumber,
      locationSupportPhoneNumberMap,
      sender,
      replyTo: configReplyTo,
      ...emailRest
    } = baseEmail;
    let supportPhoneNumber = defaultSupportPhoneNumber;
    if (locationSupportPhoneNumberMap && (templateData as any).location) {
      supportPhoneNumber = locationSupportPhoneNumberMap[(templateData as any).location] || defaultSupportPhoneNumber;
    }

    const fromEmail = ENVIRONMENT === 'production' ? sender : defaultBCCAndLowersEmail;
    const replyTo = ENVIRONMENT === 'production' ? configReplyTo : defaultBCCAndLowersEmail;

    const email = {
      ...emailRest,
      supportPhoneNumber,
    };

    const emailConfiguration = {
      to,
      from: {
        email: fromEmail,
        name: projectName,
      },
      bcc: SENDGRID_EMAIL_BCC,
      replyTo,
      templateId,
      dynamic_template_data: {
        ...templateData,
        env: environmentSubjectPrepend,
        branding: {
          email,
          projectName,
          projectDomain,
        },
      },
    };

    const featureFlag = this.config.featureFlag;

    if (!featureFlag || template.disabled) {
      console.log('Email sending is disabled');
      console.log('Email input being swallowed: ', JSON.stringify(emailConfiguration, null, 2));
      return;
    } else {
      JSON.stringify(emailConfiguration, null, 2);
    }

    try {
      const sendResult = await sendgrid.send(emailConfiguration);
      console.log(
        `Details of successful sendgrid send: statusCode, ${sendResult[0].statusCode}. body, ${JSON.stringify(
          sendResult[0].body
        )}`
      );
    } catch (error) {
      const errorMessage = `Error sending email ${templateIdSecretName} to ${to} (${projectName}})`;
      console.error(`${errorMessage}: ${error}`);
      void sendErrors(errorMessage, ENVIRONMENT);
    }
  }

  async sendErrorEmail(
    to: string | string[],
    templateData: DynamicTemplateDataRecord<typeof this.config.templates.errorReport>
  ): Promise<void> {
    const recipients = typeof to === 'string' ? [to] : [...to];

    if (!recipients.includes('ottehr-support@masslight.com')) {
      recipients.push('ottehr-support@masslight.com');
    }

    await this.sendEmail(recipients, this.config.templates.errorReport, templateData);
  }

  async sendVirtualConfirmationEmail(
    to: string | string[],
    templateData: DynamicTemplateDataRecord<typeof this.config.templates.telemedConfirmation>
  ): Promise<void> {
    await this.sendEmail(to, this.config.templates.telemedConfirmation, templateData);
  }

  async sendVirtualCancelationEmail(
    to: string | string[],
    templateData: DynamicTemplateDataRecord<typeof this.config.templates.telemedCancelation>
  ): Promise<void> {
    await this.sendEmail(to, this.config.templates.telemedCancelation, templateData);
  }

  async sendVirtualCompletionEmail(
    to: string | string[],
    templateData: DynamicTemplateDataRecord<typeof this.config.templates.telemedCompletion>
  ): Promise<void> {
    await this.sendEmail(to, this.config.templates.telemedCompletion, templateData);
  }

  async sendVideoChatInvitationEmail(
    to: string | string[],
    templateData: DynamicTemplateDataRecord<typeof this.config.templates.telemedInvitation>
  ): Promise<void> {
    await this.sendEmail(to, this.config.templates.telemedInvitation, templateData);
  }

  async sendInPersonConfirmationEmail(
    to: string | string[],
    templateData: DynamicTemplateDataRecord<typeof this.config.templates.inPersonConfirmation>
  ): Promise<void> {
    await this.sendEmail(to, this.config.templates.inPersonConfirmation, templateData);
  }
  async sendInPersonCancelationEmail(
    to: string | string[],
    templateData: DynamicTemplateDataRecord<typeof this.config.templates.inPersonCancelation>
  ): Promise<void> {
    await this.sendEmail(to, this.config.templates.inPersonCancelation, templateData);
  }
  async sendInPersonCompletionEmail(
    to: string | string[],
    templateData: DynamicTemplateDataRecord<typeof this.config.templates.inPersonCompletion>
  ): Promise<void> {
    const template = this.config.templates.inPersonCompletion;
    await this.sendEmail(to, template, templateData);
  }

  async sendInPersonReminderEmail(
    email: string | string[],
    templateData: DynamicTemplateDataRecord<typeof this.config.templates.inPersonReminder>
  ): Promise<void> {
    const template = this.config.templates.inPersonReminder;
    await this.sendEmail(email, template, templateData);
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
