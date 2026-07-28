import { DocumentReference } from 'fhir/r4b';
import {
  DocumentType,
  INSURANCE_CARD_CODE,
  INVALID_INPUT_ERROR,
  LOINC_SYSTEM,
  MISSING_REQUEST_BODY,
  Secrets,
} from 'utils';
import { ZambdaInput } from '../../../shared';

// The four card *image* slots. Other titles sharing the 64290-0 type code (e.g. the
// 'fullInsuranceCard' PDFs) fire the subscription too but are skipped, not errored —
// same title allowlist get-visit-files applies.
export const CARD_IMAGE_TITLES: readonly DocumentType[] = [
  DocumentType.InsuranceFront,
  DocumentType.InsuranceBack,
  DocumentType.InsuranceFrontSecondary,
  DocumentType.InsuranceBackSecondary,
];

export type ExtractInsuranceCardInput = { documentReference: DocumentReference; secrets: Secrets | null } & (
  | { skip: true; skipReason: string }
  | { skip: false; cardSlot: DocumentType; attachmentUrl: string }
);

export function validateRequestParameters(input: ZambdaInput): ExtractInsuranceCardInput {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  let documentReference: DocumentReference;
  try {
    documentReference = JSON.parse(input.body) as DocumentReference;
  } catch {
    throw INVALID_INPUT_ERROR('Request body is not valid JSON');
  }

  if (documentReference.resourceType !== 'DocumentReference') {
    throw INVALID_INPUT_ERROR(`Expected DocumentReference but got ${documentReference.resourceType}`);
  }

  if (!documentReference.id) {
    throw INVALID_INPUT_ERROR('DocumentReference is missing id');
  }

  if (documentReference.status !== 'current') {
    throw INVALID_INPUT_ERROR(`Expected current status but got ${documentReference.status}`);
  }

  const isInsuranceCardType =
    documentReference.type?.coding?.some(
      (coding) => coding.system === LOINC_SYSTEM && coding.code === INSURANCE_CARD_CODE
    ) ?? false;
  if (!isInsuranceCardType) {
    throw INVALID_INPUT_ERROR(
      `DocumentReference/${documentReference.id} does not carry the insurance card type coding ${LOINC_SYSTEM}|${INSURANCE_CARD_CODE}`
    );
  }

  const attachment = documentReference.content?.[0]?.attachment;
  if (!attachment?.url) {
    throw INVALID_INPUT_ERROR(`DocumentReference/${documentReference.id} has no attachment URL`);
  }

  const title = attachment.title;
  if (!title || !CARD_IMAGE_TITLES.includes(title as DocumentType)) {
    return {
      skip: true,
      skipReason: `attachment title '${title ?? '<none>'}' is not an insurance card image slot`,
      documentReference,
      secrets: input.secrets,
    };
  }

  return {
    skip: false,
    documentReference,
    cardSlot: title as DocumentType,
    attachmentUrl: attachment.url,
    secrets: input.secrets,
  };
}
