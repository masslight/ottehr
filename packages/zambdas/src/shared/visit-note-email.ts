import Oystehr from '@oystehr/sdk';
import { Task } from 'fhir/r4b';
import { InPersonCompletionTemplateData, Secrets, TelemedCompletionTemplateData } from 'utils';
import { getEmailClient, makeAddressUrl } from './communication';
import {
  completeOutboundDeliveryAttempt,
  createOutboundDeliveryAttempt,
  failOutboundDeliveryAttempt,
  requireOutboundDeliveryValue,
} from './outbound-delivery';

interface BaseVisitNoteEmailInput {
  oystehr: Oystehr;
  secrets: Secrets | null;
  patientId: string;
  appointmentId: string;
  recipientEmail: string;
  recipientName?: string;
  documentReferenceId: string;
  parentAttemptId?: string;
  requesterReference?: string;
  senderId?: string;
  senderDisplay?: string;
}

type VisitNoteEmailInput = BaseVisitNoteEmailInput &
  (
    | { mode: 'in-person'; templateData: InPersonCompletionTemplateData }
    | { mode: 'virtual'; templateData: TelemedCompletionTemplateData }
  );

export type VisitNoteEmailTemplate =
  | { mode: 'in-person'; templateData: InPersonCompletionTemplateData }
  | { mode: 'virtual'; templateData: TelemedCompletionTemplateData };

export interface VisitNoteEmailClient {
  getFeatureFlag(): boolean;
  sendInPersonCompletionEmail(to: string, templateData: InPersonCompletionTemplateData): Promise<void>;
  sendVirtualCompletionEmail(to: string, templateData: TelemedCompletionTemplateData): Promise<void>;
}

export function buildVisitNoteEmailTemplate(input: {
  isInPerson: boolean;
  locationName: string | undefined;
  visitNoteUrl: string | undefined;
  address?: string;
  prettyStartTime?: string;
}): VisitNoteEmailTemplate {
  const location = requireOutboundDeliveryValue(input.locationName, 'location name');
  const visitNoteUrl = requireOutboundDeliveryValue(input.visitNoteUrl, 'visit note URL');
  if (!input.isInPerson) {
    return { mode: 'virtual', templateData: { location, 'visit-note-url': visitNoteUrl } };
  }

  const address = requireOutboundDeliveryValue(input.address, 'location address');
  return {
    mode: 'in-person',
    templateData: {
      location,
      time: requireOutboundDeliveryValue(input.prettyStartTime, 'appointment time'),
      address,
      'address-url': makeAddressUrl(address),
      'visit-note-url': visitNoteUrl,
    },
  };
}

export async function sendVisitNoteEmailAttempt(
  input: VisitNoteEmailInput,
  existingEmailClient?: VisitNoteEmailClient
): Promise<Task> {
  const emailClient = existingEmailClient ?? getEmailClient(input.secrets, input.oystehr);
  if (!emailClient.getFeatureFlag()) throw new Error('Visit note email delivery is disabled');
  requireOutboundDeliveryValue(input.recipientEmail, 'Email recipient');
  requireOutboundDeliveryValue(input.documentReferenceId, 'Visit note DocumentReference');

  const attempt = await createOutboundDeliveryAttempt(input.oystehr, {
    channel: 'email',
    patientId: input.patientId,
    appointmentId: input.appointmentId,
    recipientAddress: input.recipientEmail,
    recipientName: input.recipientName,
    documentReferenceId: input.documentReferenceId,
    parentAttemptId: input.parentAttemptId,
    requesterReference: input.requesterReference,
    senderId: input.senderId,
    senderDisplay: input.senderDisplay,
  });
  if (!attempt.id) throw new Error('Outbound email attempt was created without an id');

  return deliverVisitNoteEmailAttempt(input, attempt, emailClient);
}

/** Sends and settles an email using an attempt that has already been persisted. */
export async function deliverVisitNoteEmailAttempt(
  input: VisitNoteEmailInput,
  attempt: Task,
  emailClient: VisitNoteEmailClient
): Promise<Task> {
  if (!attempt.id) throw new Error('Outbound email attempt is missing an id');

  try {
    if (input.mode === 'in-person') {
      await emailClient.sendInPersonCompletionEmail(input.recipientEmail, input.templateData);
    } else {
      await emailClient.sendVirtualCompletionEmail(input.recipientEmail, input.templateData);
    }
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
