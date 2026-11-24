import { Attachment, DocumentReference } from 'fhir/r4b';
import { LOINC_SYSTEM } from 'utils/lib/fhir/vitals';
import { DocumentType } from 'utils/lib/types/data/documents';
import { INSURANCE_CARD_CODE, PHOTO_ID_CARD_CODE } from 'utils/lib/types/data/paperwork/paperwork.constants';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { NORMALIZABLE_CONTENT_TYPES } from '../extract-insurance-card/normalize-image';
import { CARD_IMAGE_TITLES as INSURANCE_CARD_IMAGE_TITLES } from '../extract-insurance-card/validateRequestParameters';

/** The photo-ID image slot titles; excludes the fullPhotoIDCard PDF. */
const PHOTO_ID_IMAGE_TITLES: readonly DocumentType[] = [DocumentType.PhotoIdFront, DocumentType.PhotoIdBack];

/**
 * Each rotatable card kind: its LOINC type code and the attachment titles of its image slots. A
 * DocumentReference must match BOTH halves of one entry, so e.g. an insurance-coded DocRef with a
 * photo-ID title is still rejected.
 */
const ROTATABLE_CARD_KINDS: readonly { label: string; code: string; titles: readonly DocumentType[] }[] = [
  { label: 'insurance card', code: INSURANCE_CARD_CODE, titles: INSURANCE_CARD_IMAGE_TITLES },
  { label: 'photo ID', code: PHOTO_ID_CARD_CODE, titles: PHOTO_ID_IMAGE_TITLES },
];

/**
 * Confirms the DocumentReference is a current card *image* (insurance card or photo ID) that can be
 * manually rotated: status current, the 64290-0 insurance-card or 55188-7 photo-ID type coding, an
 * attachment url, one of that card kind's image slot titles (insurance: the same allowlist
 * extract-insurance-card uses; photo ID: photo-id-front / photo-id-back — both exclude the composed
 * full-card PDFs), and a jimp-decodable image contentType when one is recorded.
 *
 * Throws structured INVALID_INPUT_ERRORs; these surface to the staff member who clicked rotate.
 */
export function assertRotatableCardImage(documentReference: DocumentReference): Attachment & { url: string } {
  const docRefId = documentReference.id;

  if (documentReference.status !== 'current') {
    throw INVALID_INPUT_ERROR(
      `DocumentReference/${docRefId} is not current (status: ${documentReference.status}); the card may have been re-uploaded — refresh and try again`
    );
  }

  const cardKind = ROTATABLE_CARD_KINDS.find(
    (kind) =>
      documentReference.type?.coding?.some((coding) => coding.system === LOINC_SYSTEM && coding.code === kind.code)
  );
  if (!cardKind) {
    throw INVALID_INPUT_ERROR(
      `DocumentReference/${docRefId} does not carry the insurance card (${LOINC_SYSTEM}|${INSURANCE_CARD_CODE}) or photo ID (${LOINC_SYSTEM}|${PHOTO_ID_CARD_CODE}) type coding`
    );
  }

  const attachment = documentReference.content?.[0]?.attachment;
  if (!attachment?.url) {
    throw INVALID_INPUT_ERROR(`DocumentReference/${docRefId} has no attachment URL`);
  }

  if (!attachment.title || !cardKind.titles.includes(attachment.title as DocumentType)) {
    throw INVALID_INPUT_ERROR(
      `DocumentReference/${docRefId} attachment title '${attachment.title ?? '<none>'}' is not a ${
        cardKind.label
      } image slot`
    );
  }

  // contentType is optional on the attachment; when present it must be an image type we can decode
  if (
    attachment.contentType !== undefined &&
    !(NORMALIZABLE_CONTENT_TYPES as readonly string[]).includes(attachment.contentType)
  ) {
    throw INVALID_INPUT_ERROR(
      `DocumentReference/${docRefId} attachment contentType '${attachment.contentType}' is not a rotatable image type`
    );
  }

  return attachment as Attachment & { url: string };
}
