import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { DocumentReference, List } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { createFilesDocumentReferences } from 'utils/lib/fhir/helpers';
import { LOINC_SYSTEM } from 'utils/lib/fhir/vitals';
import { VISIT_DETAILS_CODE } from 'utils/lib/types/data/paperwork/paperwork.constants';
import { PdfInfo } from './pdf-utils';

export async function makeVisitDetailsPdfDocumentReference(
  oystehr: Oystehr,
  pdfInfo: PdfInfo,
  patientId: string,
  appointmentId: string,
  encounterId: string,
  listResources: List[],
  attached?: string[],
  signingCopy = false
): Promise<DocumentReference> {
  const { docRefs } = await createFilesDocumentReferences({
    docStatus: signingCopy ? 'final' : undefined,
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
          code: VISIT_DETAILS_CODE,
          display: 'Visit details',
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

export const findSignedVisitDetailsDocument = async (
  oystehr: Oystehr,
  encounterId: string
): Promise<DocumentReference | undefined> =>
  (
    await oystehr.fhir.search<DocumentReference>({
      resourceType: 'DocumentReference',
      params: [
        { name: 'status', value: 'current' },
        { name: 'encounter', value: `Encounter/${encounterId}` },
        { name: 'type', value: `${LOINC_SYSTEM}|${VISIT_DETAILS_CODE}` },
      ],
    })
  )
    .unbundle()
    .find(
      (doc) =>
        doc.docStatus === 'final' &&
        !!doc.type?.coding?.some((coding) => coding.system === 'http://loinc.org' && coding.code === VISIT_DETAILS_CODE)
    );
