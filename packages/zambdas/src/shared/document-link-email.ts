import Oystehr from '@oystehr/sdk';
import { Task } from 'fhir/r4b';
import { SignJWT } from 'jose';
import { escapeHtml } from 'utils/lib/helpers/helpers';
import { PROJECT_WEBSITE } from 'utils/lib/ottehr-config/branding';
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
  /** Printed in the email so the recipient knows who sent the documents. */
  organizationName: string;
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

export function buildDocumentLinkEmail(input: {
  organizationName: string;
  senderDisplay?: string;
  url: string;
}): GenericOutreachTemplateData {
  const organization = escapeHtml(input.organizationName);
  const sender = input.senderDisplay ? `${escapeHtml(input.senderDisplay)} at ${organization}` : organization;
  return {
    'subject-text': `Documents from ${input.organizationName}`,
    content:
      `<p>${sender} has sent you documents.</p>` +
      `<p><a href="${escapeHtml(input.url)}">Open documents</a></p>` +
      '<p>This link expires in one hour. If it has expired, open it anyway and a fresh link will be emailed to you.</p>',
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

  return deliverDocumentLinkEmailAttempt(input, attempt, emailClient);
}

/** Sends and settles a document link email using an attempt that has already been persisted. */
export async function deliverDocumentLinkEmailAttempt(
  input: DocumentLinkEmailInput,
  attempt: Task,
  emailClient: DocumentLinkEmailClient
): Promise<Task> {
  if (!attempt.id) throw new Error('Outbound email attempt is missing an id');

  try {
    const token = await mintDocumentLinkToken(attempt.id, input.secrets);
    await emailClient.sendGenericOutreachEmail(
      input.email,
      buildDocumentLinkEmail({
        organizationName: input.organizationName,
        senderDisplay: input.senderDisplay,
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
