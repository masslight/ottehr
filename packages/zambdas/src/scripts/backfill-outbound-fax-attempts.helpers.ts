import Oystehr from '@oystehr/sdk';
import { Communication, Practitioner, Provenance, Task } from 'fhir/r4b';
import {
  getAllFhirSearchPages,
  getFullestAvailableName,
  makeOutboundDeliveryAttempt,
  OUTBOUND_DELIVERY_SOURCE_IDENTIFIER_SYSTEM,
  OYSTEHR_FAX_COMMUNICATION_IDENTIFIER_SYSTEM,
  PROVENANCE_FAX_ACTIVITY_CODES,
  PROVENANCE_FAX_SYSTEM,
  removePrefix,
} from 'utils';
import { createOutboundDeliveryAttemptIdempotently } from '../shared/outbound-delivery';

const BACKFILL_PAGE_SIZE = 100;
const BACKFILL_CREATE_CONCURRENCY = 5;

export interface OutboundFaxBackfillStats {
  examined: number;
  created: number;
  existing: number;
  skipped: number;
  failed: number;
}

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

export async function backfillOutboundFaxAttempts(
  oystehr: Oystehr,
  dryRun: boolean
): Promise<OutboundFaxBackfillStats> {
  const stats: OutboundFaxBackfillStats = { examined: 0, created: 0, existing: 0, skipped: 0, failed: 0 };
  let offset = 0;
  let total = 1;

  while (offset < total) {
    const bundle = await oystehr.fhir.search<Communication>({
      resourceType: 'Communication',
      params: [
        { name: 'identifier', value: `${OYSTEHR_FAX_COMMUNICATION_IDENTIFIER_SYSTEM}|` },
        { name: '_count', value: String(BACKFILL_PAGE_SIZE) },
        { name: '_offset', value: String(offset) },
        { name: '_total', value: 'accurate' },
      ],
    });
    const communications = bundle.unbundle();
    total = bundle.total ?? offset + communications.length + (communications.length === BACKFILL_PAGE_SIZE ? 1 : 0);
    if (!communications.length) break;
    stats.examined += communications.length;

    const communicationIds = communications.flatMap((communication) => (communication.id ? [communication.id] : []));
    const provenances = communicationIds.length
      ? await getAllFhirSearchPages<Provenance>(
          {
            resourceType: 'Provenance',
            params: [
              { name: 'target', value: communicationIds.map((id) => `Communication/${id}`).join(',') },
              {
                name: 'activity',
                value: `${PROVENANCE_FAX_SYSTEM}|${PROVENANCE_FAX_ACTIVITY_CODES.faxSent}`,
              },
            ],
          },
          oystehr,
          BACKFILL_PAGE_SIZE
        )
      : [];
    const provenanceByCommunication = new Map<string, Provenance>();
    for (const provenance of provenances) {
      const communicationId = provenance.target
        .map((target) => removePrefix('Communication/', target.reference ?? ''))
        .find(Boolean);
      if (communicationId) provenanceByCommunication.set(communicationId, provenance);
    }

    const existingSources = dryRun
      ? await getExistingSourceIdentifiers(
          oystehr,
          communicationIds.map((id) => `Communication/${id}`)
        )
      : new Set<string>();
    for (let index = 0; index < communications.length; index += BACKFILL_CREATE_CONCURRENCY) {
      const batch = communications.slice(index, index + BACKFILL_CREATE_CONCURRENCY);
      await Promise.all(
        batch.map(async (communication) => {
          const source = communication.id ? `Communication/${communication.id}` : undefined;
          if (!source) {
            stats.skipped++;
            return;
          }
          const task = buildLegacyFaxAttempt(communication, provenanceByCommunication.get(communication.id!));
          if (!task) {
            stats.skipped++;
            return;
          }
          if (dryRun) {
            if (existingSources.has(source)) stats.existing++;
            else stats.created++;
            return;
          }
          try {
            const result = await createOutboundDeliveryAttemptIdempotently(oystehr, task, {
              system: OUTBOUND_DELIVERY_SOURCE_IDENTIFIER_SYSTEM,
              value: source,
            });
            if (result.status === 'created') stats.created++;
            else stats.existing++;
          } catch (error) {
            stats.failed++;
            console.error(`Failed to backfill outbound fax Communication/${communication.id}`, error);
          }
        })
      );
    }
    offset += communications.length;
  }

  return stats;
}

async function getExistingSourceIdentifiers(oystehr: Oystehr, sources: string[]): Promise<Set<string>> {
  if (!sources.length) return new Set();
  const tasks = await getAllFhirSearchPages<Task>(
    {
      resourceType: 'Task',
      params: [
        {
          name: 'identifier',
          value: sources.map((source) => `${OUTBOUND_DELIVERY_SOURCE_IDENTIFIER_SYSTEM}|${source}`).join(','),
        },
      ],
    },
    oystehr,
    BACKFILL_PAGE_SIZE
  );
  return new Set(
    tasks.flatMap((task) =>
      (task.identifier ?? []).flatMap((identifier) =>
        identifier.system === OUTBOUND_DELIVERY_SOURCE_IDENTIFIER_SYSTEM && identifier.value ? [identifier.value] : []
      )
    )
  );
}
