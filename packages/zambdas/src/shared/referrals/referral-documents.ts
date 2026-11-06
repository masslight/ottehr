import Oystehr from '@oystehr/sdk';
import { Appointment, DocumentReference, Encounter, FhirResource, List } from 'fhir/r4b';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { isCustomFolderList, PATIENT_FOLDERS_CODE } from 'utils/lib/fhir/list';
import { isReferralDocumentFolderAllowed, isReferralLabResult } from 'utils/lib/fhir/referral';
import { removePrefix } from 'utils/lib/helpers/helpers';
import { ReferralEarlierDocument } from 'utils/lib/types/api/referrals/referrals.types';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { isFaxPacket, isMedicalRecordExport } from '../patient-documents';

/**
 * One message for every document that cannot go out with a referral, whether it does not exist, is another
 * patient's, or sits in a folder referrals do not send, so the response never says which documents exist.
 */
export const REFERRAL_DOCUMENT_REJECTED_MESSAGE =
  'One or more of the chosen documents cannot be sent with this referral';

/** A document from an earlier visit that passed the referral checks, with the start of its visit. */
export interface ReferralDocument {
  documentReference: DocumentReference;
  visitDate?: string;
}

/** Ids per `_id` search, so the query string stays well under URL limits. */
const ID_SEARCH_CHUNK = 50;

const searchByIds = async <T extends FhirResource>(
  oystehr: Oystehr,
  resourceType: T['resourceType'],
  ids: string[],
  extraParams: { name: string; value: string }[] = []
): Promise<T[]> => {
  const unique = [...new Set(ids)];
  const results: T[] = [];
  for (let i = 0; i < unique.length; i += ID_SEARCH_CHUNK) {
    const chunk = unique.slice(i, i + ID_SEARCH_CHUNK);
    results.push(
      ...(await getAllFhirSearchPages<T>(
        { resourceType, params: [{ name: '_id', value: chunk.join(',') }, ...extraParams] },
        oystehr
      ))
    );
  }
  return results;
};

const referencedIds = (references: { reference?: string }[] | undefined, prefix: string): string[] =>
  (references ?? [])
    .map((reference) => removePrefix(prefix, reference.reference ?? ''))
    .filter((id): id is string => !!id);

/** The system folders (internal names) each of the patient's documents is filed in. */
const loadFolderNamesByDocument = async (oystehr: Oystehr, patientId: string): Promise<Map<string, string[]>> => {
  const folders = (
    await oystehr.fhir.search<List>({
      resourceType: 'List',
      params: [
        { name: 'subject', value: `Patient/${patientId}` },
        { name: 'code', value: PATIENT_FOLDERS_CODE },
      ],
    })
  )
    .unbundle()
    .filter((list) => list.status === 'current' && !!list.title && !isCustomFolderList(list));
  const byDocument = new Map<string, string[]>();
  for (const folder of folders) {
    for (const id of referencedIds(
      (folder.entry ?? []).map((entry) => entry.item),
      'DocumentReference/'
    )) {
      byDocument.set(id, [...(byDocument.get(id) ?? []), folder.title!]);
    }
  }
  return byDocument;
};

/** Start of each document's visit: the encounter's appointment first, as the Docs table's Visit column resolves it. */
const loadVisitDates = async (
  oystehr: Oystehr,
  documents: DocumentReference[]
): Promise<Map<string, string | undefined>> => {
  const encounters = await searchByIds<Encounter>(
    oystehr,
    'Encounter',
    documents.flatMap((document) => referencedIds(document.context?.encounter, 'Encounter/'))
  );
  const appointments = await searchByIds<Appointment>(oystehr, 'Appointment', [
    ...encounters.flatMap((encounter) => referencedIds(encounter.appointment, 'Appointment/')),
    ...documents.flatMap((document) => referencedIds(document.context?.related, 'Appointment/')),
  ]);
  const appointmentStart = new Map(appointments.map((appointment) => [appointment.id, appointment.start]));
  const encounterStart = new Map(
    encounters.map((encounter) => [
      encounter.id,
      appointmentStart.get(referencedIds(encounter.appointment, 'Appointment/')[0]) ?? encounter.period?.start,
    ])
  );
  return new Map(
    documents.map((document) => [
      document.id!,
      referencedIds(document.context?.encounter, 'Encounter/')
        .map((id) => encounterStart.get(id))
        .find(Boolean) ??
        referencedIds(document.context?.related, 'Appointment/')
          .map((id) => appointmentStart.get(id))
          .find(Boolean),
    ])
  );
};

/** Whether a document of this patient may go out with a referral. The one rule save and fax both apply. */
const isSendableWithReferral = (document: DocumentReference, patientId: string, folderNames: string[]): boolean =>
  document.subject?.reference === `Patient/${patientId}` &&
  document.status !== 'superseded' &&
  document.status !== 'entered-in-error' &&
  !isFaxPacket(document) &&
  !isMedicalRecordExport(document) &&
  folderNames.some((folderName) => isReferralDocumentFolderAllowed(folderName, isReferralLabResult(document)));

/**
 * The given documents that may still go out with a referral for this patient, by id. The search is scoped to
 * the patient server-side, so another patient's document is simply not found.
 */
export const findReferralDocuments = async (
  oystehr: Oystehr,
  patientId: string,
  documentReferenceIds: string[]
): Promise<Map<string, ReferralDocument>> => {
  if (!documentReferenceIds.length) return new Map();
  const [documents, folderNames] = await Promise.all([
    searchByIds<DocumentReference>(oystehr, 'DocumentReference', documentReferenceIds, [
      { name: 'subject', value: `Patient/${patientId}` },
    ]),
    loadFolderNamesByDocument(oystehr, patientId),
  ]);
  const sendable = documents.filter(
    (document) => !!document.id && isSendableWithReferral(document, patientId, folderNames.get(document.id) ?? [])
  );
  const visitDates = await loadVisitDates(oystehr, sendable);
  return new Map(
    sendable.map((document) => [document.id!, { documentReference: document, visitDate: visitDates.get(document.id!) }])
  );
};

/** Every given document, in the given order, or a client error naming none of them when any one fails the checks. */
export const loadReferralDocuments = async (
  oystehr: Oystehr,
  patientId: string,
  documentReferenceIds: string[]
): Promise<ReferralDocument[]> => {
  const found = await findReferralDocuments(oystehr, patientId, documentReferenceIds);
  return documentReferenceIds.map((id) => {
    const document = found.get(id);
    if (!document) throw INVALID_INPUT_ERROR(REFERRAL_DOCUMENT_REJECTED_MESSAGE);
    return document;
  });
};

/** Oldest first by visit, falling back to when the document was added: the order the packet sends them in. */
export const byVisitDateAscending = (a: ReferralDocument, b: ReferralDocument): number =>
  (a.visitDate ?? a.documentReference.date ?? '').localeCompare(b.visitDate ?? b.documentReference.date ?? '');

/** The name the Docs table shows: each attachment's title, joined. */
export const referralDocumentTitle = (document: DocumentReference): string =>
  (document.content ?? [])
    .map((content) => content.attachment?.title)
    .filter((title): title is string => !!title)
    .join(' & ') || 'Document';

export const toReferralEarlierDocument = ({
  documentReference,
  visitDate,
}: ReferralDocument): ReferralEarlierDocument => ({
  id: documentReference.id ?? '',
  title: referralDocumentTitle(documentReference),
  date: documentReference.date,
  visitDate,
});
