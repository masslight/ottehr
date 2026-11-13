import Oystehr from '@oystehr/sdk';
import { DocumentReference } from 'fhir/r4b';
import { MedicalRecordDateRange } from 'utils/lib/types/data/get-patient-medical-record.types';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { getFileNameFromUrl, getMimeType, isFaxableAttachment } from 'utils/lib/utils/file';
import {
  collectPatientRecordAttachments,
  getPatientRecordDocuments,
  isFaxPacket,
  isMedicalRecordExport,
} from '../patient-documents';
import { DocumentPacketPart } from './collect-visit-documents';

/**
 * Documents picked from the patient's record rather than a visit's package: the whole record, or
 * one row of their Docs table. Formats a fax machine cannot render (zip archives, XML, …) are left
 * out — the medical record archive in particular is a zip of the very documents being faxed.
 */
const toParts = (documents: DocumentReference[]): DocumentPacketPart[] =>
  collectPatientRecordAttachments(documents)
    .filter((attachment) => isFaxableAttachment(attachment))
    .map((attachment) => ({
      title: attachment.title || getFileNameFromUrl(attachment.url) || 'Document',
      z3Url: attachment.url,
      contentType: attachment.contentType ?? getMimeType(attachment.url),
    }));

/** Oldest first, so the packet reads in the order the record was created. */
const byDateAscending = (a: DocumentReference, b: DocumentReference): number =>
  (a.date ?? '').localeCompare(b.date ?? '');

/** Every faxable document on file for the patient — the same set the record archive collects. */
export const collectMedicalRecordParts = async (
  oystehr: Oystehr,
  patientId: string,
  dateRange: MedicalRecordDateRange
): Promise<DocumentPacketPart[]> => {
  const documents = await getPatientRecordDocuments(oystehr, patientId, dateRange);
  return toParts([...documents].sort(byDateAscending));
};

/** One document, after confirming it is the patient's. */
export const getPacketSourceDocument = async (
  oystehr: Oystehr,
  patientId: string,
  documentReferenceId: string
): Promise<DocumentReference> => {
  const document = await oystehr.fhir.get<DocumentReference>({
    resourceType: 'DocumentReference',
    id: documentReferenceId,
  });
  if (document.subject?.reference !== `Patient/${patientId}`) {
    throw INVALID_INPUT_ERROR('The requested document does not belong to this patient');
  }
  if (isFaxPacket(document) || isMedicalRecordExport(document)) {
    throw INVALID_INPUT_ERROR(
      'Generated medical record exports and sent packets cannot be used as packet source documents'
    );
  }
  return document;
};

export const collectDocumentParts = (document: DocumentReference): DocumentPacketPart[] => toParts([document]);
