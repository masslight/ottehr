import { DocumentReference, Reference, ServiceRequest } from 'fhir/r4b';
import { docRefIsLabGeneratedResult, docRefIsOttehrGeneratedResultAndCurrent } from '../helpers/labs/helpers';
import { FaxDocumentKind } from '../types/api/fax.types';
import {
  ReferralAsk,
  ReferralCloseReason,
  ReferralScheduler,
  ReferralStatus,
  ReferralUrgency,
  SaveReferralInput,
} from '../types/api/referrals/referrals.types';
import { BUCKET_NAMES } from './constants';
import { readExtensionJson, withExtensionJson } from './extensions';
import { ORDER_TYPE_CODE_SYSTEM } from './radiology';

/**
 * How a referral is stored.
 *
 * ServiceRequest tagged `order-type-tag|referral` (the same tag system radiology orders use), `intent` order,
 * `code` SNOMED "Patient referral", `performerType.text` the specialty, `performer[0]` the address-book
 * Organization (absent when the patient will choose), `priority` the urgency, `reasonCode[0].text` the
 * reason, `note[0].text` the notes to the recipient, `requester` the referring provider, `subject` and
 * `encounter` the patient and visit. The Ottehr-only fields live in one JSON extension (`ReferralDetails`),
 * following `readExtensionJson` / `withExtensionJson`. `ServiceRequest.status` mirrors the referral status
 * so plain FHIR searches for active/completed requests still make sense.
 *
 * Documents from the patient's earlier visits that go out with the referral are `supportingInfo` references to
 * their DocumentReferences, in the order staff chose them.
 *
 * Documents of a referral (the form and filed responses) are DocumentReferences with `context.related`
 * naming the ServiceRequest; the form is told apart by its `referral-form` type. Nothing on the
 * ServiceRequest lists them, so filing a response is one transaction with no second write to keep in step.
 */

export const REFERRAL_ORDER_TYPE_TAG = { system: ORDER_TYPE_CODE_SYSTEM, code: 'referral' } as const;
export const REFERRAL_ORDER_TYPE_TAG_TOKEN = `${REFERRAL_ORDER_TYPE_TAG.system}|${REFERRAL_ORDER_TYPE_TAG.code}`;

export const REFERRAL_SERVICE_REQUEST_CODE = {
  system: 'http://snomed.info/sct',
  code: '3457005',
  display: 'Patient referral',
} as const;

export const REFERRAL_DETAILS_EXTENSION_URL = 'https://fhir.ottehr.com/Extension/referral-details';

/** DocumentReference type for the one-page referral form (mirrors RADIOLOGY_ORDER_FORM_DOC_REF_DOCTYPE). */
export const REFERRAL_FORM_DOC_REF_DOCTYPE = {
  system: 'http://ottehr.org/fhir/StructureDefinition/referral-form',
  code: 'referral-form',
  display: 'Referral Form',
} as const;
/** Identifier stamped on the form DocumentReference with the ServiceRequest version it was rendered from. */
export const REFERRAL_FORM_SOURCE_VERSION_IDENTIFIER_SYSTEM =
  'https://fhir.ottehr.com/Identifier/referral-form-source-version';

/**
 * Patient Docs folders (internal names) whose documents can go out with a referral. The picker offers only
 * these, and save-referral and the fax packet check every chosen document against them.
 */
export const REFERRAL_DOCUMENT_FOLDERS: readonly string[] = [
  BUCKET_NAMES.VISIT_NOTES,
  BUCKET_NAMES.LABS,
  BUCKET_NAMES.RADIOLOGY_REPORTS,
];

/** A lab result report, as opposed to the order forms, eReqs, specimen labels and ABNs the Labs folder also holds. */
export const isReferralLabResult = (docRef: DocumentReference): boolean =>
  docRefIsOttehrGeneratedResultAndCurrent(docRef) || docRefIsLabGeneratedResult(docRef);

/** Whether a document filed in `folderName` can go out with a referral: from the Labs folder, results only. */
export const isReferralDocumentFolderAllowed = (folderName: string, isLabResult: boolean): boolean =>
  REFERRAL_DOCUMENT_FOLDERS.includes(folderName) && (folderName !== BUCKET_NAMES.LABS || isLabResult);

/** Ids of the earlier-visit documents chosen for the referral, in the order they were chosen. */
export const getReferralEarlierDocumentIds = (serviceRequest: ServiceRequest): string[] =>
  (serviceRequest.supportingInfo ?? [])
    .map((reference) => reference.reference ?? '')
    .filter((reference) => reference.startsWith('DocumentReference/'))
    .map((reference) => reference.replace('DocumentReference/', ''));

export interface ReferralDetails {
  status: ReferralStatus;
  whatIsAsked: ReferralAsk;
  whoSchedules: ReferralScheduler;
  responseRequested: boolean;
  includeDocuments: FaxDocumentKind[];
  /**
   * The number in the form's Fax field at save, whether the picker copied it from the contact or staff typed it.
   * The referral faxes to this number; later edits to the directory contact do not change it.
   */
  recipientFax?: string;
  sentAt?: string;
  /** When the patient was given a printed copy; a fax still sets the status, so this outlives `given-to-patient`. */
  givenToPatientAt?: string;
  closedAt?: string;
  closeReason?: ReferralCloseReason;
  outcome?: string;
}

const FHIR_STATUS_BY_REFERRAL_STATUS: Record<ReferralStatus, ServiceRequest['status']> = {
  'not-sent': 'draft',
  sent: 'active',
  'given-to-patient': 'active',
  'response-received': 'active',
  closed: 'completed',
  cancelled: 'revoked',
};

export const getReferralDetails = (serviceRequest: ServiceRequest): ReferralDetails | undefined =>
  readExtensionJson<ReferralDetails>(serviceRequest, REFERRAL_DETAILS_EXTENSION_URL);

export const isReferralServiceRequest = (serviceRequest: ServiceRequest): boolean =>
  !!serviceRequest.meta?.tag?.some(
    (tag) => tag.system === REFERRAL_ORDER_TYPE_TAG.system && tag.code === REFERRAL_ORDER_TYPE_TAG.code
  );

export const getReferralSpecialty = (serviceRequest: ServiceRequest): string =>
  serviceRequest.performerType?.text ?? '';
export const getReferralReason = (serviceRequest: ServiceRequest): string => serviceRequest.reasonCode?.[0]?.text ?? '';
export const getReferralUrgency = (serviceRequest: ServiceRequest): ReferralUrgency =>
  serviceRequest.priority === 'urgent' || serviceRequest.priority === 'asap' ? serviceRequest.priority : 'routine';
export const getReferralNotesToRecipient = (serviceRequest: ServiceRequest): string | undefined =>
  serviceRequest.note?.[0]?.text;
export const getReferralRecipientContactId = (serviceRequest: ServiceRequest): string | undefined =>
  serviceRequest.performer?.[0]?.reference?.replace('Organization/', '');
export const getReferralStatus = (serviceRequest: ServiceRequest): ReferralStatus =>
  getReferralDetails(serviceRequest)?.status ?? 'not-sent';
/** The fax number saved on the referral, when one was. */
export const getReferralRecipientFax = (serviceRequest: ServiceRequest): string | undefined =>
  getReferralDetails(serviceRequest)?.recipientFax || undefined;

export interface MakeReferralServiceRequestOptions {
  patientId: string;
  encounterId?: string;
  /** `{ reference: 'Practitioner/<id>', display }` from resolveCallerPractitionerRef. */
  requester: Reference;
  /** Display for `performer[0]`; the reference is built from `input.recipientContactId`. */
  recipientDisplay?: string;
  /** The stored resource when editing: id, meta, authoredOn and details not in the input are kept. */
  existing?: ServiceRequest;
  now: string;
}

/**
 * Builds the ServiceRequest for a new or edited referral. Status is kept from `existing`; a new referral
 * starts as `not-sent`. Sending, giving to the patient, responses and closing go through
 * `withReferralDetails`, not through this function.
 */
export const makeReferralServiceRequest = (
  input: SaveReferralInput,
  options: MakeReferralServiceRequestOptions
): ServiceRequest => {
  const { existing } = options;
  const existingDetails = existing ? getReferralDetails(existing) : undefined;
  const details: ReferralDetails = {
    ...existingDetails,
    status: existingDetails?.status ?? 'not-sent',
    whatIsAsked: input.whatIsAsked,
    whoSchedules: input.whoSchedules,
    responseRequested: input.responseRequested,
    includeDocuments: input.includeDocuments,
    recipientFax: input.recipientContactId && input.recipientFax ? input.recipientFax : undefined,
  };
  const base: ServiceRequest = {
    resourceType: 'ServiceRequest',
    ...(existing?.id ? { id: existing.id } : {}),
    meta: {
      ...existing?.meta,
      tag: [
        ...(existing?.meta?.tag ?? []).filter((tag) => tag.system !== REFERRAL_ORDER_TYPE_TAG.system),
        { ...REFERRAL_ORDER_TYPE_TAG },
      ],
    },
    status: FHIR_STATUS_BY_REFERRAL_STATUS[details.status],
    intent: 'order',
    priority: input.urgency,
    code: { coding: [{ ...REFERRAL_SERVICE_REQUEST_CODE }], text: 'Referral' },
    performerType: { text: input.specialty },
    subject: { reference: `Patient/${options.patientId}` },
    ...(options.encounterId ? { encounter: { reference: `Encounter/${options.encounterId}` } } : {}),
    requester: existing?.requester ?? options.requester,
    authoredOn: existing?.authoredOn ?? options.now,
    reasonCode: [{ text: input.reason }],
    ...(input.recipientContactId
      ? {
          performer: [
            {
              reference: `Organization/${input.recipientContactId}`,
              type: 'Organization',
              display: options.recipientDisplay,
            },
          ],
        }
      : {}),
    ...(input.notesToRecipient ? { note: [{ text: input.notesToRecipient, time: options.now }] } : {}),
    ...(input.earlierDocumentIds?.length
      ? { supportingInfo: input.earlierDocumentIds.map((id) => ({ reference: `DocumentReference/${id}` })) }
      : {}),
  };
  return { ...base, extension: withExtensionJson(existing ?? base, REFERRAL_DETAILS_EXTENSION_URL, details) };
};

/** The ServiceRequest with its details patched and `status` kept in step with the referral status. */
export const withReferralDetails = (
  serviceRequest: ServiceRequest,
  patch: Partial<ReferralDetails>
): ServiceRequest => {
  const current = getReferralDetails(serviceRequest);
  const details: ReferralDetails = {
    status: 'not-sent',
    whatIsAsked: 'evaluate-and-treat',
    whoSchedules: 'patient',
    responseRequested: false,
    includeDocuments: [],
    ...current,
    ...patch,
  };
  return {
    ...serviceRequest,
    status: FHIR_STATUS_BY_REFERRAL_STATUS[details.status],
    extension: withExtensionJson(serviceRequest, REFERRAL_DETAILS_EXTENSION_URL, details),
  };
};
