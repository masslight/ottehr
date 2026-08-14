import Oystehr from '@oystehr/sdk';
import { DocumentReference } from 'fhir/r4b';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { FAX_PACKET_CODE, MEDICAL_RECORD_EXPORT_CODE } from 'utils/lib/types/data/paperwork/paperwork.constants';

/** One attachment of a patient document, reduced to what the medical-record exports need. */
export interface PatientRecordAttachment {
  url: string;
  title?: string;
  contentType?: string;
  /** Creation date of the owning document. */
  date?: string;
}

/**
 * Every DocumentReference of a patient, following pagination so a "complete" record is never
 * truncated by a single page. No status filter: include every document the patient/staff sees in
 * the Docs UI (e.g. superseded discharge summaries), matching "all patient documents".
 */
export const getAllPatientDocumentReferences = async (
  oystehr: Oystehr,
  patientId: string
): Promise<DocumentReference[]> =>
  getAllFhirSearchPages<DocumentReference>(
    {
      resourceType: 'DocumentReference',
      params: [{ name: 'subject', value: `Patient/${patientId}` }],
    },
    oystehr
  );

/**
 * Identifies the DocumentReference we create for a generated archive, so prior exports are excluded
 * from a new export (otherwise each export would be bundled into the next).
 */
export const isMedicalRecordExport = (docRef: DocumentReference): boolean =>
  (docRef.type?.coding ?? []).some((coding) => coding.code === MEDICAL_RECORD_EXPORT_CODE);

/** A transmitted packet may carry recipient details and must never become source material for a later export. */
export const isFaxPacket = (docRef: DocumentReference): boolean =>
  (docRef.type?.coding ?? []).some((coding) => coding.code === FAX_PACKET_CODE);

/** Flattens exportable documents, dropping generated archives and sent packets to prevent recursive exports. */
export const collectPatientRecordAttachments = (documentReferences: DocumentReference[]): PatientRecordAttachment[] =>
  documentReferences
    .filter((docRef) => !isMedicalRecordExport(docRef) && !isFaxPacket(docRef))
    .flatMap((docRef) =>
      (docRef.content ?? [])
        .map((content) => content.attachment)
        .filter((attachment) => !!attachment?.url)
        .map((attachment) => ({
          url: attachment.url as string,
          title: attachment.title,
          contentType: attachment.contentType,
          date: docRef.date,
        }))
    );
