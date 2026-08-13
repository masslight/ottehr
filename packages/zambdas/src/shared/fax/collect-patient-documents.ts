import Oystehr from '@oystehr/sdk';
import { DocumentReference } from 'fhir/r4b';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { getFileNameFromUrl, isFaxableAttachment } from 'utils/lib/utils/file';
import { collectPatientRecordAttachments, getAllPatientDocumentReferences } from '../patient-documents';
import { FaxPacketPart } from './collect-visit-documents';

/**
 * Documents that are not scoped to a visit: the patient's whole record, or one row of their Docs
 * table. Formats a fax machine cannot render (zip archives, XML, …) are left out — the medical
 * record archive in particular is a zip of the very documents being faxed.
 */
const toParts = (documents: DocumentReference[]): FaxPacketPart[] =>
  collectPatientRecordAttachments(documents)
    .filter((attachment) => isFaxableAttachment(attachment))
    .map((attachment) => ({
      title: attachment.title || getFileNameFromUrl(attachment.url) || 'Document',
      z3Url: attachment.url,
    }));

/** Oldest first, so the packet reads in the order the record was created. */
const byDateAscending = (a: DocumentReference, b: DocumentReference): number =>
  (a.date ?? '').localeCompare(b.date ?? '');

/** Every faxable document on file for the patient — the same set the record archive collects. */
export const collectMedicalRecordParts = async (oystehr: Oystehr, patientId: string): Promise<FaxPacketPart[]> => {
  const documents = await getAllPatientDocumentReferences(oystehr, patientId);
  return toParts([...documents].sort(byDateAscending));
};

/** One document, after confirming it is the patient's. */
export const collectDocumentParts = async (
  oystehr: Oystehr,
  patientId: string,
  documentReferenceId: string
): Promise<FaxPacketPart[]> => {
  const document = await oystehr.fhir.get<DocumentReference>({
    resourceType: 'DocumentReference',
    id: documentReferenceId,
  });
  if (document.subject?.reference !== `Patient/${patientId}`) {
    throw INVALID_INPUT_ERROR('The requested document does not belong to this patient');
  }
  return toParts([document]);
};
