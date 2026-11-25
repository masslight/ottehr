import { Attachment, DocumentReference } from 'fhir/r4b';
import { LOINC_SYSTEM } from 'utils/lib/fhir/vitals';
import { DocumentType } from 'utils/lib/types/data/documents';
import { INSURANCE_CARD_CODE, PHOTO_ID_CARD_CODE } from 'utils/lib/types/data/paperwork/paperwork.constants';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { NORMALIZABLE_CONTENT_TYPES } from '../extract-insurance-card/normalize-image';
import { CARD_IMAGE_TITLES } from '../extract-insurance-card/validateRequestParameters';

// The card *image* slots that staff may rotate, grouped by the LOINC type code their DocumentReferences
// carry. The composed full-card PDFs (fullInsuranceCard / fullPhotoIDCard) share the codes but are
// not images, so they are deliberately absent from the title lists.
const ROTATABLE_CARD_SLOTS: { code: string; label: string; titles: readonly DocumentType[] }[] = [
  { code: INSURANCE_CARD_CODE, label: 'insurance card', titles: CARD_IMAGE_TITLES },
  { code: PHOTO_ID_CARD_CODE, label: 'photo ID', titles: [DocumentType.PhotoIdFront, DocumentType.PhotoIdBack] },
];

/**
 * Confirms the DocumentReference is a current insurance-card or photo-ID *image* that can be
 * manually rotated: status current, a recognized card type coding (64290-0 insurance, 55188-7 photo
 * ID), an attachment url, an image slot title that belongs to THAT type (the same allowlists
 * extract-insurance-card uses for insurance; this excludes the full-card PDFs), and a
 * jimp-decodable image contentType when one is recorded.
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

  const slot = ROTATABLE_CARD_SLOTS.find(
    ({ code }) =>
      documentReference.type?.coding?.some((coding) => coding.system === LOINC_SYSTEM && coding.code === code)
  );
  if (!slot) {
    throw INVALID_INPUT_ERROR(
      `DocumentReference/${docRefId} does not carry the insurance card (${LOINC_SYSTEM}|${INSURANCE_CARD_CODE}) or photo ID (${LOINC_SYSTEM}|${PHOTO_ID_CARD_CODE}) type coding`
    );
  }

  const attachment = documentReference.content?.[0]?.attachment;
  if (!attachment?.url) {
    throw INVALID_INPUT_ERROR(`DocumentReference/${docRefId} has no attachment URL`);
  }

  if (!attachment.title || !slot.titles.includes(attachment.title as DocumentType)) {
    throw INVALID_INPUT_ERROR(
      `DocumentReference/${docRefId} attachment title '${attachment.title ?? '<none>'}' is not a ${
        slot.label
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
