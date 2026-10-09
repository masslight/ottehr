import Oystehr from '@oystehr/sdk';
import { Task } from 'fhir/r4b';
import { SignJWT } from 'jose';
import { escapeHtml, formatPhoneNumberDisplay } from 'utils/lib/helpers/helpers';
import { BRANDING_CONFIG, PROJECT_WEBSITE } from 'utils/lib/ottehr-config/branding';
import { GenericOutreachTemplateData } from 'utils/lib/ottehr-config/sendgrid';
import { getSecret, Secrets, SecretsKeys } from 'utils/lib/secrets';
import { DOCUMENT_LINK_AUDIENCE, DOCUMENT_LINK_TTL } from 'utils/lib/types/api/fax.types';
import { EmailSendOptions, getEmailClient } from './communication';
import {
  completeOutboundDeliveryAttempt,
  createOutboundDeliveryAttempt,
  failOutboundDeliveryAttempt,
  requireOutboundDeliveryValue,
} from './outbound-delivery';

export interface DocumentLinkEmailInput {
  oystehr: Oystehr;
  secrets: Secrets | null;
  patientId: string;
  /** Absent when the packet does not belong to a single visit (a medical record, or one document). */
  appointmentId?: string;
  email: string;
  recipientName?: string;
  recipientOrganization?: string;
  /** Follow-up voice number for the recipient. Recorded on the attempt; never dialled. */
  recipientPhone?: string;
  /** The packet PDF the link opens. */
  documentReferenceId: string;
  organizationId: string;
  /** The number a recipient who got the email in error is told to call (see `getLocationContactPhone`). */
  contactPhone?: string;
  senderDisplay?: string;
  requesterReference?: string;
  senderId?: string;
  parentAttemptId?: string;
}

export interface DocumentLinkEmailClient {
  getFeatureFlag(): boolean;
  sendGenericOutreachEmail(
    to: string,
    templateData: GenericOutreachTemplateData,
    options?: EmailSendOptions
  ): Promise<void>;
}

/**
 * The emailed link carries only this token. Its subject is the attempt Task, from which `open-document-link`
 * resolves the document and the recipient; the HMAC signature is what makes the URL unguessable.
 */
export async function mintDocumentLinkToken(attemptTaskId: string, secrets: Secrets | null): Promise<string> {
  const secret = new TextEncoder().encode(getSecret(SecretsKeys.DOCUMENT_LINK_SECRET, secrets));
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(attemptTaskId)
    .setIssuer(PROJECT_WEBSITE)
    .setAudience(DOCUMENT_LINK_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(DOCUMENT_LINK_TTL)
    .sign(secret);
}

/**
 * The token travels in the URL fragment: it never reaches the intake host's access logs, proxies or error
 * telemetry, and the intake client treats a `?token=` query parameter as a bearer token.
 */
export const makeDocumentLinkUrl = (token: string, secrets: Secrets | null): string =>
  `${getSecret(SecretsKeys.WEBSITE_URL, secrets)}/documents#${token}`;

const NOTICE_STYLE = 'margin: 0 0 1em; font-size: 13px; line-height: 18px; color: #333333;';

const notice = (heading: string, text: string): string =>
  `<p style="${NOTICE_STYLE}"><strong>${heading}</strong><br />${text}</p>`;

export function buildDocumentLinkEmail(input: {
  senderDisplay?: string;
  contactPhone?: string;
  url: string;
}): GenericOutreachTemplateData {
  // The practice's brand name; the Organization's name is a generated "<project> Organization".
  const practiceName = BRANDING_CONFIG.projectName;
  const practice = escapeHtml(practiceName);
  const senderName = input.senderDisplay ? escapeHtml(input.senderDisplay) : undefined;
  const sender = senderName ? `${senderName} at ${practice}` : practice;
  const contact = input.contactPhone
    ? `${practice} at ${escapeHtml(formatPhoneNumberDisplay(input.contactPhone))}`
    : 'the sender';
  return {
    'subject-text': `Documents from ${practiceName}`,
    // The footer's website is the patient portal, which third-party recipients have no use for.
    'hide-copyright': true,
    content:
      `<p>${sender} sent you information from their Electronic Health Record system.</p>` +
      `<p><a href="${escapeHtml(input.url)}">Open documents</a></p>` +
      '<p>This link expires in one hour. If it has expired, opening it will send you a new link.</p>' +
      '<hr style="height: 1px; border-width: 0px; background-color: #dfe5e9; margin: 32px 0 24px" />' +
      notice(
        'Do Not Share This Email',
        'This email contains a secure link. Please do not share this email or link with others.'
      ) +
      notice(
        'How This Email Originated',
        `This is not an automated email. ${senderName ?? 'A staff member'} sent you these documents from within ` +
          "the practice's EHR."
      ) +
      notice(
        'Important Notice',
        'This email is intended only for the person to whom it is addressed and may contain privileged and ' +
          'confidential information, including protected health information. If you are not the intended ' +
          'recipient, any disclosure, copying, distribution, or use of its contents is strictly prohibited. If you ' +
          `received this email in error, please delete it and contact ${contact}.`
      ),
  };
}

/** Records the outbound delivery attempt, then emails a link to the packet and settles the attempt's outcome. */
export async function sendDocumentLinkEmailAttempt(
  input: DocumentLinkEmailInput,
  existingEmailClient?: DocumentLinkEmailClient
): Promise<Task> {
  const emailClient = existingEmailClient ?? getEmailClient(input.secrets, input.oystehr);
  if (!emailClient.getFeatureFlag()) throw new Error('Document link email delivery is disabled');
  requireOutboundDeliveryValue(input.email, 'Email recipient');
  requireOutboundDeliveryValue(input.documentReferenceId, 'Document packet DocumentReference');

  const attempt = await createOutboundDeliveryAttempt(input.oystehr, {
    channel: 'email',
    patientId: input.patientId,
    appointmentId: input.appointmentId,
    recipientAddress: input.email,
    recipientName: input.recipientName,
    recipientOrganization: input.recipientOrganization,
    recipientPhone: input.recipientPhone,
    documentReferenceId: input.documentReferenceId,
    requesterReference: input.requesterReference,
    senderOrganizationReference: `Organization/${input.organizationId}`,
    parentAttemptId: input.parentAttemptId,
    senderId: input.senderId,
    senderDisplay: input.senderDisplay,
  });
  if (!attempt.id) throw new Error('Outbound email attempt was created without an id');

  try {
    const token = await mintDocumentLinkToken(attempt.id, input.secrets);
    await emailClient.sendGenericOutreachEmail(
      input.email,
      buildDocumentLinkEmail({
        senderDisplay: input.senderDisplay,
        contactPhone: input.contactPhone,
        url: makeDocumentLinkUrl(token, input.secrets),
      }),
      // Click tracking would route the link (a live credential) through SendGrid's redirect service and logs.
      { disableClickTracking: true }
    );
  } catch (error) {
    await failOutboundDeliveryAttempt(input.oystehr, attempt.id, error);
    throw error;
  }

  try {
    return await completeOutboundDeliveryAttempt(input.oystehr, attempt.id);
  } catch (patchError) {
    console.error(`Email was accepted but Task/${attempt.id} could not be marked completed`, patchError);
    throw new Error(`Email was accepted but its outbound attempt could not be completed: ${attempt.id}`);
  }
}
