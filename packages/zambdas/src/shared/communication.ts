import Oystehr from '@oystehr/sdk';
import sendgrid from '@sendgrid/mail';
import { Location, Patient, RelatedPerson } from 'fhir/r4b';
import {
  BRANDING_CONFIG,
  buildLocationSupportPhonesMap,
  DynamicTemplateDataRecord,
  EmailTemplate,
  ErrorReportTemplateData,
  FEATURE_FLAGS_CONFIG,
  getAllFhirSearchPages,
  getPatientContactEmail,
  getRelatedPersonsForPatient,
  getSecret,
  getSupportPhoneFor,
  InPersonCancelationTemplateData,
  InPersonCompletionTemplateData,
  InPersonConfirmationTemplateData,
  InPersonReceiptTemplateData,
  InPersonReminderTemplateData,
  OrderResultAlertTemplateData,
  Secrets,
  SecretsKeys,
  SENDGRID_CONFIG,
  SendgridConfig,
  TelemedCancelationTemplateData,
  TelemedCompletionTemplateData,
  TelemedConfirmationTemplateData,
  TelemedInvitationTemplateData,
} from 'utils';
import { sendErrors } from './errors';
import { reportMissingUserRelatedPerson } from './invariants';

export interface EmailAttachment {
  content: string; // Base64 encoded content
  filename: string;
  type: string;
  disposition?: 'attachment' | 'inline';
  contentId?: string;
}

const defaultLowersFromEmail = 'ottehr-support@masslight.com'; // todo: change to support@ottehr.com when doing so does not land things in spam folder

async function fetchLocationSupportPhonesMap(oystehr: Oystehr): Promise<Record<string, string>> {
  const locations = await getAllFhirSearchPages<Location>({ resourceType: 'Location' }, oystehr);
  return buildLocationSupportPhonesMap(locations);
}

class EmailClient {
  private config: SendgridConfig;
  private secrets: Secrets | null;
  private featureFlag: boolean;
  private oystehr: Oystehr;
  private supportPhonesMapPromise?: Promise<Record<string, string>>;

  constructor(config: SendgridConfig, featureFlag: boolean, secrets: Secrets | null, oystehr: Oystehr) {
    this.config = config;
    this.secrets = secrets;
    this.featureFlag = featureFlag;
    this.oystehr = oystehr;
    let SENDGRID_SEND_EMAIL_API_KEY = '';
    try {
      SENDGRID_SEND_EMAIL_API_KEY = getSecret(SecretsKeys.SENDGRID_SEND_EMAIL_API_KEY, secrets);
    } catch {
      if (!this.featureFlag) {
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
      if (!this.featureFlag || template.disabled) {
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

    const { sender, replyTo: configReplyTo, ...emailRest } = baseEmail;
    if (!this.supportPhonesMapPromise) {
      this.supportPhonesMapPromise = fetchLocationSupportPhonesMap(this.oystehr);
    }
    const supportPhonesMap = await this.supportPhonesMapPromise;
    const supportPhoneNumber = getSupportPhoneFor((templateData as any).location, supportPhonesMap);

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

    if (!this.featureFlag || template.disabled) {
      console.log('Email sending is disabled');
      console.log(`featureFlag: ${this.featureFlag}, template.disabled: ${template.disabled}`);
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
    return this.featureFlag;
  }

  async sendErrorEmail(to: string | string[], templateData: ErrorReportTemplateData): Promise<void> {
    const recipients = typeof to === 'string' ? [to] : [...to];

    const ottehrSupportEmail = BRANDING_CONFIG.email.sender;
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

  async sendOrderResultAlert(to: string | string[], templateData: OrderResultAlertTemplateData): Promise<void> {
    await this.sendEmail(to, this.config.templates.orderResultAlert, templateData);
  }
}

export const getEmailClient = (secrets: Secrets | null, oystehr: Oystehr): EmailClient => {
  return new EmailClient(SENDGRID_CONFIG, FEATURE_FLAGS_CONFIG.sendgridEnabled, secrets, oystehr);
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

/**
 * How `sendSmsToRelatedPersons` reacts to per-recipient send failures:
 * - `'all'`          — throw if ANY recipient fails.
 * - `'partial-ok'`   — (default) throw only if EVERY recipient fails; partial success is OK.
 * - `'never-throw'`  — never throw. Failures are still routed to Sentry via `sendErrors`.
 */
export type SmsFanoutFailStrategy = 'all' | 'partial-ok' | 'never-throw';

export interface SendSmsToRelatedPersonsInput {
  relatedPersons: RelatedPerson[];
  message: string;
  oystehr: Oystehr;
  env: string;
  failStrategy?: SmsFanoutFailStrategy;
}

export interface SendSmsToRelatedPersonsResult {
  total: number;
  sent: number;
  failures: { recipient: string; error: unknown }[];
}

/**
 * Fan-out a single SMS to every RelatedPerson in the list. Centralises the
 * `Promise.allSettled` + per-recipient logging + all-fail-vs-partial-success decision so that
 * callers don't keep reimplementing it.
 *
 * Callers must have already resolved the RelatedPersons they want to reach — this helper does
 * not look them up, and does not fire the "missing user-relatedperson" invariant signal.
 */
export async function sendSmsToRelatedPersons({
  relatedPersons,
  message,
  oystehr,
  env,
  failStrategy = 'partial-ok',
}: SendSmsToRelatedPersonsInput): Promise<SendSmsToRelatedPersonsResult> {
  if (!relatedPersons.length) {
    return { total: 0, sent: 0, failures: [] };
  }

  const withId: { id: string }[] = [];
  const failures: { recipient: string; error: unknown }[] = [];
  for (const rp of relatedPersons) {
    if (rp.id) {
      withId.push({ id: rp.id });
    } else {
      const error = new Error('RelatedPerson missing id');
      console.log('sms send error: RelatedPerson/<missing-id>:', error.message);
      failures.push({ recipient: 'RelatedPerson/<missing-id>', error });
      void sendErrors(error, env);
    }
  }

  const results = await Promise.allSettled(
    withId.map((rp) => oystehr.transactionalSMS.send({ message, resource: `RelatedPerson/${rp.id}` }))
  );

  results.forEach((r, idx) => {
    const recipient = `RelatedPerson/${withId[idx].id}`;
    if (r.status === 'fulfilled') {
      console.log(`sms send ok: ${recipient}`, r.value);
    } else {
      console.log(`sms send error: ${recipient}:`, JSON.stringify(r.reason));
      failures.push({ recipient, error: r.reason });
      void sendErrors(r.reason, env);
    }
  });

  if (failStrategy === 'all' && failures.length > 0) {
    throw failures[0].error;
  }
  if (failStrategy === 'partial-ok' && failures.length === relatedPersons.length) {
    throw failures[0].error;
  }

  return {
    total: relatedPersons.length,
    sent: relatedPersons.length - failures.length,
    failures,
  };
}

export async function sendSmsForPatient(
  message: string,
  oystehr: Oystehr,
  patient: Patient | undefined,
  ENVIRONMENT: string
): Promise<void> {
  if (!patient?.id) {
    console.error("Message didn't send because no patient was found for encounter");
    return;
  }
  const relatedPersons = await getRelatedPersonsForPatient(patient.id, oystehr);
  if (!relatedPersons.length) {
    console.error(`Message didn't send because no user-relatedperson was found for patient ${patient.id}`);
    reportMissingUserRelatedPerson('sendSmsForPatient', patient.id);
    return;
  }
  await sendSmsToRelatedPersons({
    relatedPersons,
    message,
    oystehr,
    env: ENVIRONMENT,
    failStrategy: 'never-throw',
  });
}

/**
 * Sends email alert to patient - your [lab | radiology] order results are ready
 * emailDetails will be passed into the email template order-result-alert.html
 */
export const sendOrderResultEmailToPatient = async ({
  fhirPatient,
  emailDetails,
  secrets,
  oystehr,
}: {
  fhirPatient: Patient;
  emailDetails: {
    orderType: 'lab' | 'radiology';
    testName: string;
    visitDate: string;
    appointmentId: string;
    locationName: string; // needs to match the branding config so the support phone can be pulled
  };
  secrets: Secrets | null;
  oystehr: Oystehr;
}): Promise<void> => {
  console.log('email details: ', JSON.stringify(emailDetails));
  const emailClient = getEmailClient(secrets, oystehr);
  const patientEmail = getPatientContactEmail(fhirPatient);

  if (emailClient.getFeatureFlag()) {
    if (patientEmail) {
      console.log(`sending order result alert to Patient/${fhirPatient.id} via email ${patientEmail}`);

      const { orderType, testName, visitDate, appointmentId, locationName } = emailDetails;

      const templateData: OrderResultAlertTemplateData = {
        'order-type': orderType,
        'test-name': testName,
        'visit-date': visitDate,
        'result-url': makePastVisitDetailUrl(fhirPatient.id || '', appointmentId, secrets),
        location: locationName,
      };
      await emailClient.sendOrderResultAlert(patientEmail, templateData);
    } else {
      console.log(`patient email is missing for Patient/${fhirPatient.id} so skipping order result alert`);
    }
  } else {
    console.log(`email client feature flag is false, will not send order result alert to Patient/${fhirPatient.id}`);
  }
};

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

export const makePastVisitDetailUrl = (patientId: string, visitId: string, secrets: Secrets | null): string => {
  const baseUrl = getSecret(SecretsKeys.WEBSITE_URL, secrets);
  return `${baseUrl}/my-patients/${patientId}/past-visits/${visitId}`;
};
