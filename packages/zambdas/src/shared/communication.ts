import Oystehr, { TransactionalSMSSendParams } from '@oystehr/sdk';
import sendgrid from '@sendgrid/mail';
import { Appointment, Patient } from 'fhir/r4b';
import {
  DynamicTemplateDataRecord,
  EmailTemplate,
  ErrorReportTemplateData,
  getSecret,
  InPersonCancelationTemplateData,
  InPersonCompletionTemplateData,
  InPersonConfirmationTemplateData,
  InPersonReceiptTemplateData,
  InPersonReminderTemplateData,
  Secrets,
  SecretsKeys,
  SENDGRID_CONFIG,
  SendgridConfig,
  TelemedCancelationTemplateData,
  TelemedCompletionTemplateData,
  TelemedConfirmationTemplateData,
  TelemedInvitationTemplateData,
} from 'utils';
import { BRANDING_CONFIG } from 'utils/lib/configuration/branding';
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

export interface EmailAttachment {
  content: string; // Base64 encoded content
  filename: string;
  type: string;
  disposition?: 'attachment' | 'inline';
  contentId?: string;
}

const defaultLowersFromEmail = 'ottehr-support@masslight.com'; // todo: change to support@ottehr.com when doing so does not land things in spam folder
class EmailClient {
  private config: SendgridConfig;
  private secrets: Secrets | null;

  constructor(config: SendgridConfig, secrets: Secrets | null) {
    this.config = config;
    this.secrets = secrets;
    let SENDGRID_SEND_EMAIL_API_KEY = '';
    try {
      SENDGRID_SEND_EMAIL_API_KEY = getSecret(SecretsKeys.SENDGRID_SEND_EMAIL_API_KEY, secrets);
    } catch {
      if (!this.config.featureFlag) {
        console.log(`${SENDGRID_SEND_EMAIL_API_KEY} not found but email sending is disabled, continuing`);
      } else {
        throw new Error('SendGrid Send Email API key is not set in secrets');
      }
    }
    sendgrid.setApiKey(SENDGRID_SEND_EMAIL_API_KEY);
  }

  private async sendEmail<T extends EmailTemplate>(
    to: string | string[],
    template: T,
    templateData: DynamicTemplateDataRecord<T>,
    attachments?: EmailAttachment[]
  ): Promise<void> {
    const { templateIdSecretName } = template;
    let SENDGRID_EMAIL_BCC: string[] = [];
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, this.secrets);
    const environmentSubjectPrepend = ENVIRONMENT === 'production' ? '' : `[${ENVIRONMENT}] `;
    let templateId = '';
    try {
      templateId = getSecret(templateIdSecretName, this.secrets);
    } catch (error) {
      if (!this.config.featureFlag || template.disabled) {
        console.log(`${templateIdSecretName} not found but email sending is disabled, continuing`);
      } else {
        throw error;
      }
    }
    if (ENVIRONMENT === 'local') {
      SENDGRID_EMAIL_BCC = [];
    }

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

    const fromEmail = ENVIRONMENT !== 'local' ? sender : defaultLowersFromEmail;
    const replyTo = ENVIRONMENT !== 'local' ? configReplyTo : defaultLowersFromEmail;

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
      bcc: SENDGRID_EMAIL_BCC.filter((item): item is string => !to.includes(item)),
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
      ...(attachments &&
        attachments.length > 0 && {
          attachments: attachments.map((attachment) => ({
            content: attachment.content,
            filename: attachment.filename,
            type: attachment.type,
            disposition: attachment.disposition || 'attachment',
            ...(attachment.contentId && { content_id: attachment.contentId }),
          })),
        }),
    };

    const featureFlag = this.config.featureFlag;

    if (!featureFlag || template.disabled) {
      console.log('Email sending is disabled');
      console.log(`featureFlag: ${featureFlag}, template.disabled: ${template.disabled}`);
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

  getFeatureFlag(): boolean {
    return this.config.featureFlag;
  }

  async sendErrorEmail(to: string | string[], templateData: ErrorReportTemplateData): Promise<void> {
    const recipients = typeof to === 'string' ? [to] : [...to];

    const ottehrSupportEmail = 'support@ottehr.com';
    if (!recipients.includes(ottehrSupportEmail)) {
      recipients.push(ottehrSupportEmail);
    }

    await this.sendEmail(recipients, this.config.templates.errorReport, templateData);
  }

  async sendVirtualConfirmationEmail(
    to: string | string[],
    templateData: TelemedConfirmationTemplateData
  ): Promise<void> {
    await this.sendEmail(to, this.config.templates.telemedConfirmation, templateData);
  }

  async sendVirtualCancelationEmail(
    to: string | string[],
    templateData: TelemedCancelationTemplateData
  ): Promise<void> {
    await this.sendEmail(to, this.config.templates.telemedCancelation, templateData);
  }

  async sendVirtualCompletionEmail(to: string | string[], templateData: TelemedCompletionTemplateData): Promise<void> {
    await this.sendEmail(to, this.config.templates.telemedCompletion, templateData);
  }

  async sendVideoChatInvitationEmail(
    to: string | string[],
    templateData: TelemedInvitationTemplateData
  ): Promise<void> {
    await this.sendEmail(to, this.config.templates.telemedInvitation, templateData);
  }

  async sendInPersonConfirmationEmail(
    to: string | string[],
    templateData: InPersonConfirmationTemplateData
  ): Promise<void> {
    await this.sendEmail(to, this.config.templates.inPersonConfirmation, templateData);
  }
  async sendInPersonCancelationEmail(
    to: string | string[],
    templateData: InPersonCancelationTemplateData
  ): Promise<void> {
    await this.sendEmail(to, this.config.templates.inPersonCancelation, templateData);
  }
  async sendInPersonCompletionEmail(
    to: string | string[],
    templateData: InPersonCompletionTemplateData
  ): Promise<void> {
    await this.sendEmail(to, this.config.templates.inPersonCompletion, templateData);
  }

  async sendInPersonReminderEmail(email: string | string[], templateData: InPersonReminderTemplateData): Promise<void> {
    await this.sendEmail(email, this.config.templates.inPersonReminder, templateData);
  }

  async sendInPersonReceiptEmail(
    email: string | string[],
    templateData: InPersonReceiptTemplateData,
    attachments?: EmailAttachment[]
  ): Promise<void> {
    await this.sendEmail(email, this.config.templates.inPersonReceipt, templateData, attachments);
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

export const makeCancelVisitUrl = (appointmentId: string, secrets: Secrets | null): string => {
  const baseUrl = getSecret(SecretsKeys.WEBSITE_URL, secrets);
  return `${baseUrl}/visit/${appointmentId}/cancel`;
};

export const makePaperworkUrl = (appointmentId: string, secrets: Secrets | null): string => {
  const baseUrl = getSecret(SecretsKeys.WEBSITE_URL, secrets);
  return `${baseUrl}/paperwork/${appointmentId}`;
};

export const makeJoinVisitUrl = (appointmentId: string, secrets: Secrets | null): string => {
  const baseUrl = getSecret(SecretsKeys.WEBSITE_URL, secrets);
  return `${baseUrl}/waiting-room?appointment_id=${appointmentId}`;
};

export const makeBookAgainUrl = (appointmentId: string, secrets: Secrets | null): string => {
  const baseUrl = getSecret(SecretsKeys.WEBSITE_URL, secrets);
  return `${baseUrl}/visit/${appointmentId}/book-again`;
};

export const makeModifyVisitUrl = (appointmentId: string, secrets: Secrets | null): string => {
  const baseUrl = getSecret(SecretsKeys.WEBSITE_URL, secrets);
  return `${baseUrl}/visit/${appointmentId}/reschedule`;
};

export const makeVisitLandingUrl = (appointmentId: string, secrets: Secrets | null): string => {
  const baseUrl = getSecret(SecretsKeys.WEBSITE_URL, secrets);
  return `${baseUrl}/visit/${appointmentId}`;
};

export const makeAddressUrl = (address: string): string => {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURI(address)}`;
};
