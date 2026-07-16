import { Communication, Practitioner, Provenance, Task } from 'fhir/r4b';
import { getFullestAvailableName, makeOutboundDeliveryAttempt } from 'utils';

export function buildLegacyFaxAttempt(communication: Communication, provenance?: Provenance): Task | undefined {
  const patientId = communication.subject?.reference?.split('/')[1];
  const recipientReference = communication.recipient?.[0]?.reference;
  const faxRecipient = recipientReference?.startsWith('#')
    ? communication.contained?.find((resource) => resource.id === recipientReference.slice(1))
    : undefined;
  const provenanceRecipient = provenance?.contained?.find(
    (resource): resource is Practitioner => resource.resourceType === 'Practitioner'
  );
  const recipient = faxRecipient?.resourceType === 'Practitioner' ? faxRecipient : provenanceRecipient;
  const recipientAddress = recipient?.telecom?.find((telecom) => telecom.system === 'fax')?.value;
  if (!communication.id || !patientId || !recipientAddress) return undefined;

  const appointmentId = provenance?.target
    .find((target) => target.reference?.startsWith('Appointment/'))
    ?.reference?.split('/')[1];
  const recipientName = provenanceRecipient?.name?.length
    ? getFullestAvailableName(provenanceRecipient)
    : faxRecipient?.resourceType === 'Practitioner' && faxRecipient.name?.length
    ? getFullestAvailableName(faxRecipient)
    : communication.recipient?.[0]?.display;
  return makeOutboundDeliveryAttempt({
    channel: 'fax',
    patientId,
    appointmentId,
    recipientAddress,
    recipientName,
    requesterReference: provenance?.agent?.[0]?.who?.reference,
    senderId: provenance?.agent?.[0]?.who?.identifier?.value,
    senderDisplay: provenance?.agent?.[0]?.who?.display,
    authoredOn: communication.sent ?? provenance?.occurredDateTime ?? provenance?.recorded,
    sourceIdentifier: `Communication/${communication.id}`,
    communicationReference: `Communication/${communication.id}`,
    initialStatus: 'completed',
  });
}
