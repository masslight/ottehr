import { Communication, Practitioner, Provenance, Task } from 'fhir/r4b';
import { getFullestAvailableName, makeOutboundDeliveryAttempt, removePrefix } from 'utils';

export function buildLegacyFaxAttempt(communication: Communication, provenance?: Provenance): Task | undefined {
  const patientId = removePrefix('Patient/', communication.subject?.reference ?? '');
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
    .map((target) => removePrefix('Appointment/', target.reference ?? ''))
    .find(Boolean);
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
    senderOrganizationReference: provenance?.agent?.[0]?.onBehalfOf?.reference,
    senderId: provenance?.agent?.[0]?.who?.identifier?.value,
    senderDisplay: provenance?.agent?.[0]?.who?.display,
    authoredOn: communication.sent ?? provenance?.occurredDateTime ?? provenance?.recorded,
    sourceIdentifier: `Communication/${communication.id}`,
    communicationReference: `Communication/${communication.id}`,
    initialStatus: 'completed',
  });
}
