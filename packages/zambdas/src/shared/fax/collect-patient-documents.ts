import Oystehr from '@oystehr/sdk';
import { DocumentReference } from 'fhir/r4b';
import { Secrets } from 'utils/lib/secrets';
import { MedicalRecordDateRange } from 'utils/lib/types/data/get-patient-medical-record.types';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { getFileNameFromUrl, getMimeType, isFaxableAttachment } from 'utils/lib/utils/file';
import {
  collectPatientRecordAttachments,
  getPatientRecordDocuments,
  isFaxPacket,
  isMedicalRecordExport,
} from '../patient-documents';
import { assertZ3UrlInProject } from '../presigned-file-urls/helpers';
import { byVisitDateAscending, loadReferralDocuments } from '../referrals/referral-documents';
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
): Promise<FaxPacketPart[]> => {
  const documents = await getPatientRecordDocuments(oystehr, patientId, dateRange);
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
  if (isFaxPacket(document) || isMedicalRecordExport(document)) {
    throw INVALID_INPUT_ERROR(
      'Generated medical record exports and fax packets cannot be used as fax source documents'
    );
  }
  return toParts([document]);
};

/**
 * A referral's documents from earlier visits, oldest visit first, after checking again that each one is the
 * patient's and still one a referral may send (it may have changed since the referral was saved). The packet
 * builder presigns each URL with the M2M token, so every one must be a Z3 object of this project.
 */
export const collectReferralDocumentParts = async (
  oystehr: Oystehr,
  patientId: string,
  documentReferenceIds: string[],
  secrets: Secrets | null
): Promise<FaxPacketPart[]> => {
  const documents = await loadReferralDocuments(oystehr, patientId, documentReferenceIds);
  const parts = toParts([...documents].sort(byVisitDateAscending).map(({ documentReference }) => documentReference));
  parts.forEach((part) => part.z3Url && assertZ3UrlInProject(part.z3Url, secrets));
  return parts;
};
