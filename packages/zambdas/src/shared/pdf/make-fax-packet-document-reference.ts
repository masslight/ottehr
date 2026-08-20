import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { DocumentReference, List } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { createFilesDocumentReferences } from 'utils/lib/fhir/helpers';
import { FAX_PACKET_CODE } from 'utils/lib/types/data/paperwork/paperwork.constants';
import { PdfInfo } from './pdf-utils';

/**
 * Persists a sent fax packet as a DocumentReference: on the visit when the packet is about one visit,
 * otherwise on the patient alone (a whole medical record, several visits, or a single document). The
 * uniqueness search is scoped to match, so a patient-level packet is only ever compared with the
 * patient's other packets rather than with one visit's.
 *
 * Unlike the other generated visit documents, packets are an append-only audit trail: every send —
 * including a retry and every additional recipient — is its own immutable artifact, because a retry
 * has to re-transmit the exact bytes that were originally sent.
 *
 * `createFilesDocumentReferences` supersedes an existing current DocumentReference when it finds one
 * whose `content[0].attachment.title` equals the new file's title (and reuses it outright when both
 * title and url match). Callers must therefore pass a `pdfInfo.title` that is unique per packet —
 * `buildAndUploadPacketForRecipient` derives it from the upload filename, which carries a timestamp
 * and a random UUID. With a unique title nothing older is ever patched to `superseded`.
 */
export async function makeFaxPacketDocumentReference(args: {
  oystehr: Oystehr;
  pdfInfo: PdfInfo;
  patientId: string;
  /** Visit context, when the packet belongs to one visit. Patient-level packets carry neither. */
  appointmentId?: string;
  encounterId?: string;
  listResources: List[];
}): Promise<DocumentReference> {
  const { oystehr, pdfInfo, patientId, appointmentId, encounterId, listResources } = args;

  const { docRefs } = await createFilesDocumentReferences({
    files: [
      {
        url: pdfInfo.uploadURL,
        title: pdfInfo.title,
      },
    ],
    type: {
      coding: [
        {
          system: 'http://loinc.org',
          code: FAX_PACKET_CODE,
          display: 'Fax packet',
        },
      ],
    },
    docStatus: 'final',
    references: {
      subject: {
        reference: `Patient/${patientId}`,
      },
      ...(appointmentId && encounterId
        ? {
            context: {
              related: [{ reference: `Appointment/${appointmentId}` }],
              encounter: [{ reference: `Encounter/${encounterId}` }],
            },
          }
        : {}),
    },
    dateCreated: DateTime.now().setZone('UTC').toISO() ?? '',
    oystehr,
    generateUUID: randomUUID,
    // Scoped to whatever the packet hangs off, so the unique-title check only looks at its own siblings.
    searchParams: encounterId
      ? [{ name: 'encounter', value: `Encounter/${encounterId}` }]
      : [
          { name: 'subject', value: `Patient/${patientId}` },
          { name: 'type', value: `http://loinc.org|${FAX_PACKET_CODE}` },
        ],
    listResources,
  });
  return docRefs[0];
}
