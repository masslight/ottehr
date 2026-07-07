import { DocumentReference } from 'fhir/r4b';
import {
  DocumentType,
  INVALID_INPUT_ERROR,
  LOINC_SYSTEM,
  MISSING_REQUEST_BODY,
  PHOTO_ID_CARD_CODE,
  Secrets,
} from 'utils';
import { ZambdaInput } from '../../../shared';

export type ExtractPhotoIdInput = { documentReference: DocumentReference; secrets: Secrets | null } & (
  | { skip: true; skipReason: string }
  | { skip: false; attachmentUrl: string }
);

export function validateRequestParameters(input: ZambdaInput): ExtractPhotoIdInput {
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

  const isPhotoIdType =
    documentReference.type?.coding?.some(
      (coding) => coding.system === LOINC_SYSTEM && coding.code === PHOTO_ID_CARD_CODE
    ) ?? false;
  if (!isPhotoIdType) {
    throw INVALID_INPUT_ERROR(
      `DocumentReference/${documentReference.id} does not carry the photo ID type coding ${LOINC_SYSTEM}|${PHOTO_ID_CARD_CODE}`
    );
  }

  const attachment = documentReference.content?.[0]?.attachment;
  if (!attachment?.url) {
    throw INVALID_INPUT_ERROR(`DocumentReference/${documentReference.id} has no attachment URL`);
  }

  // Only the FRONT image is extracted. Other titles sharing the 55188-7 type code (the
  // 'photo-id-back' image and the 'fullPhotoIDCard' PDFs) fire the subscription too but are
  // skipped, not errored — same graceful-skip pattern as extract-insurance-card.
  const title = attachment.title;
  if (title !== DocumentType.PhotoIdFront) {
    return {
      skip: true,
      skipReason: `attachment title '${title ?? '<none>'}' is not the photo ID front image slot`,
      documentReference,
      secrets: input.secrets,
    };
  }

  return {
    skip: false,
    documentReference,
    attachmentUrl: attachment.url,
    secrets: input.secrets,
  };
}
