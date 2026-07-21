import Oystehr from '@oystehr/sdk';
import { Practitioner, Task } from 'fhir/r4b';
import { getFullestAvailableName } from 'utils';
import {
  completeOutboundDeliveryAttempt,
  createOutboundDeliveryAttempt,
  failOutboundDeliveryAttempt,
} from './outbound-delivery';

export interface SendFaxAttemptInput {
  appointmentId: string;
  faxNumber: string;
  organizationId: string;
  patientId: string;
  media: string;
  documentReferenceId: string;
  userPractitioner: Practitioner;
  recipientName?: string;
  parentAttemptId?: string;
  senderId: string;
}

/** Records the outbound delivery attempt, then sends the fax and settles the attempt's outcome. */
export async function sendFaxAttempt(input: SendFaxAttemptInput, oystehr: Oystehr): Promise<Task> {
  const {
    appointmentId,
    faxNumber,
    organizationId,
    patientId,
    media,
    documentReferenceId,
    userPractitioner,
    recipientName,
    parentAttemptId,
    senderId,
  } = input;
  const attempt = await createOutboundDeliveryAttempt(oystehr, {
    channel: 'fax',
    patientId,
    appointmentId,
    recipientAddress: faxNumber,
    recipientName,
    documentReferenceId,
    requesterReference: userPractitioner.id ? `Practitioner/${userPractitioner.id}` : undefined,
    senderOrganizationReference: `Organization/${organizationId}`,
    parentAttemptId,
    senderId,
    senderDisplay: getFullestAvailableName(userPractitioner),
  });
  if (!attempt.id) throw new Error('Outbound fax attempt was created without an id');

  let communicationId: string;
  try {
    console.log('Sending fax to', faxNumber);
    const { communicationResource } = await oystehr.fax.send({
      media,
      quality: 'standard',
      patient: `Patient/${patientId}`,
      recipientNumber: faxNumber,
      sender: `Organization/${organizationId}`,
    });
    if (!communicationResource.id) throw new Error('Fax service returned a Communication without an id');
    communicationId = communicationResource.id;
  } catch (error) {
    await failOutboundDeliveryAttempt(oystehr, attempt.id, error);
    throw error;
  }

  try {
    return await completeOutboundDeliveryAttempt(oystehr, attempt.id, `Communication/${communicationId}`);
  } catch (linkError) {
    // The provider accepted the fax. Keep the Task in-progress so the accepted delivery remains visible and
    // distinguishable from a provider rejection, then surface the persistence failure to the caller.
    console.error(`Fax was accepted but Task/${attempt.id} could not be linked to the Communication`, linkError);
    throw new Error(`Fax was accepted but its outbound attempt could not be completed: ${attempt.id}`);
  }
}
