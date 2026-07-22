import { Attachment, DocumentReference } from 'fhir/r4b';
import { DocumentType, INSURANCE_CARD_CODE, INVALID_INPUT_ERROR, LOINC_SYSTEM } from 'utils';
import { NORMALIZABLE_CONTENT_TYPES } from '../../subscriptions/document-reference/extract-insurance-card/normalize-image';
import { CARD_IMAGE_TITLES } from '../../subscriptions/document-reference/extract-insurance-card/validateRequestParameters';

/**
 * Confirms the DocumentReference is a current insurance-card *image* that can be manually rotated:
 * status current, the 64290-0 insurance-card type coding, an attachment url, one of the four card
 * image slot titles (the same allowlist the extraction subscription uses — this excludes the
 * fullInsuranceCard PDFs), and a jimp-decodable image contentType when one is recorded.
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

  const isInsuranceCardType =
    documentReference.type?.coding?.some(
      (coding) => coding.system === LOINC_SYSTEM && coding.code === INSURANCE_CARD_CODE
    ) ?? false;
  if (!isInsuranceCardType) {
    throw INVALID_INPUT_ERROR(
      `DocumentReference/${docRefId} does not carry the insurance card type coding ${LOINC_SYSTEM}|${INSURANCE_CARD_CODE}`
    );
  }

  const attachment = documentReference.content?.[0]?.attachment;
  if (!attachment?.url) {
    throw INVALID_INPUT_ERROR(`DocumentReference/${docRefId} has no attachment URL`);
  }

  if (!attachment.title || !CARD_IMAGE_TITLES.includes(attachment.title as DocumentType)) {
    throw INVALID_INPUT_ERROR(
      `DocumentReference/${docRefId} attachment title '${
        attachment.title ?? '<none>'
      }' is not an insurance card image slot`
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
