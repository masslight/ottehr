import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { DocumentReference, List } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { createFilesDocumentReferences } from 'utils';
import { PdfInfo } from '../pdf-utils';

export async function makeVisitNotePdfDocumentReference(
  oystehr: Oystehr,
  pdfInfo: PdfInfo,
  patientId: string,
  appointmentId: string,
  encounterId: string,
  listResources: List[]
): Promise<DocumentReference> {
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
          code: '75498-6',
          display: 'Telehealth Summary note',
        },
      ],
      text: 'Telemed document',
    },
    references: {
      subject: {
        reference: `Patient/${patientId}`,
      },
      context: {
        related: [
          {
            reference: `Appointment/${appointmentId}`,
          },
        ],
        encounter: [{ reference: `Encounter/${encounterId}` }],
      },
    },
    dateCreated: DateTime.now().setZone('UTC').toISO() ?? '',
    oystehr,
    generateUUID: randomUUID,
    searchParams: [
      { name: 'encounter', value: `Encounter/${encounterId}` },
      { name: 'subject', value: `Patient/${patientId}` },
    ],
    listResources,
  });
  return docRefs[0];
}
