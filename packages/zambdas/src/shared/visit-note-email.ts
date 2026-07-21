import Oystehr from '@oystehr/sdk';
import { Task } from 'fhir/r4b';
import { InPersonCompletionTemplateData, Secrets, TelemedCompletionTemplateData } from 'utils';
import { getEmailClient, makeAddressUrl } from './communication';
import {
  completeOutboundDeliveryAttempt,
  createOutboundDeliveryAttempt,
  failOutboundDeliveryAttempt,
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
}

type VisitNoteEmailInput = BaseVisitNoteEmailInput &
  (
    | { mode: 'in-person'; templateData: InPersonCompletionTemplateData }
    | { mode: 'virtual'; templateData: TelemedCompletionTemplateData }
  );

export type VisitNoteEmailTemplate =
  | { mode: 'in-person'; templateData: InPersonCompletionTemplateData }
  | { mode: 'virtual'; templateData: TelemedCompletionTemplateData };

export function buildVisitNoteEmailTemplate(input: {
  isInPerson: boolean;
  locationName: string | undefined;
  visitNoteUrl: string | undefined;
  address?: string;
  prettyStartTime?: string;
}): VisitNoteEmailTemplate {
  const location = requiredString(input.locationName, 'location name');
  const visitNoteUrl = requiredString(input.visitNoteUrl, 'visit note URL');
  if (!input.isInPerson) {
    return { mode: 'virtual', templateData: { location, 'visit-note-url': visitNoteUrl } };
  }

  const address = requiredString(input.address, 'location address');
  return {
    mode: 'in-person',
    templateData: {
      location,
      time: requiredString(input.prettyStartTime, 'appointment time'),
      address,
      'address-url': makeAddressUrl(address),
      'visit-note-url': visitNoteUrl,
    },
  };
}

export async function sendVisitNoteEmailAttempt(input: VisitNoteEmailInput): Promise<Task> {
  const emailClient = getEmailClient(input.secrets, input.oystehr);
  if (!emailClient.getFeatureFlag()) throw new Error('Visit note email delivery is disabled');
  if (!input.recipientEmail.trim()) throw new Error('Email recipient is required');
  if (!input.documentReferenceId.trim()) throw new Error('Visit note DocumentReference is required');

  const attempt = await createOutboundDeliveryAttempt(input.oystehr, {
    channel: 'email',
    patientId: input.patientId,
    appointmentId: input.appointmentId,
    recipientAddress: input.recipientEmail,
    recipientName: input.recipientName,
    documentReferenceId: input.documentReferenceId,
    parentAttemptId: input.parentAttemptId,
  });
  if (!attempt.id) throw new Error('Outbound email attempt was created without an id');

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

function requiredString(value: string | undefined, label: string): string {
  if (!value?.trim()) throw new Error(`${label} is required`);
  return value;
}
