import {
  INSURANCE_CARD_BACK_2_ID,
  INSURANCE_CARD_BACK_ID,
  INSURANCE_CARD_FRONT_2_ID,
  INSURANCE_CARD_FRONT_ID,
  PHOTO_ID_BACK_ID,
  PHOTO_ID_FRONT_ID,
} from '../../data';

// the card *image* paperwork slots that get an upload-time DocumentReference (via the
// create-card-document-reference zambda) so card OCR extraction can run while the patient
// is still in the paperwork wizard; the paperwork harvest reuses these docs at page save
export const CARD_DOCUMENT_FILE_TYPES = [
  PHOTO_ID_FRONT_ID,
  PHOTO_ID_BACK_ID,
  INSURANCE_CARD_FRONT_ID,
  INSURANCE_CARD_BACK_ID,
  INSURANCE_CARD_FRONT_2_ID,
  INSURANCE_CARD_BACK_2_ID,
] as const;

export type CardDocumentFileType = (typeof CARD_DOCUMENT_FILE_TYPES)[number];

export function isCardDocumentFileType(value: string): value is CardDocumentFileType {
  return (CARD_DOCUMENT_FILE_TYPES as readonly string[]).includes(value);
}

export interface CreateCardDocumentReferenceInput {
  appointmentID: string;
  cardType: CardDocumentFileType;
  z3URL: string;
}

export interface CreateCardDocumentReferenceResponse {
  documentReferenceID: string;
}
