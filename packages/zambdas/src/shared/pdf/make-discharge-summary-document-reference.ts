import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { DocumentReference, List } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { createFilesDocumentReferences, DISCHARGE_SUMMARY_CODE } from 'utils';
import { PdfInfo } from './pdf-utils';

export async function makeDischargeSummaryPdfDocumentReference(
  oystehr: Oystehr,
  pdfInfo: PdfInfo,
  patientId: string,
  appointmentId: string,
  encounterId: string,
  listResources: List[],
  attached?: string[]
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
          code: DISCHARGE_SUMMARY_CODE,
          display: 'Discharge summary',
        },
      ],
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
          ...(attached?.map((id) => ({ reference: `DocumentReference/${id}` })) ?? []),
        ],
        encounter: [{ reference: `Encounter/${encounterId}` }],
      },
    },
    dateCreated: DateTime.now().setZone('UTC').toISO() ?? '',
    oystehr,
    generateUUID: randomUUID,
    searchParams: [{ name: 'encounter', value: `Encounter/${encounterId}` }],
    listResources,
  });
  return docRefs[0];
}
