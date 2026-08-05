import {
  INSURANCE_CARD_BACK_2_ID,
  INSURANCE_CARD_BACK_ID,
  INSURANCE_CARD_FRONT_2_ID,
  INSURANCE_CARD_FRONT_ID,
  InsuranceCardExtractionFields,
  PHOTO_ID_FRONT_ID,
  PhotoIdExtractionFields,
} from '../../data';

// the card *image* slots the OCR subscriptions actually store an extraction for: the four
// insurance card images plus the photo ID FRONT (extract-photo-id skips the back slot, so
// polling it would never resolve)
export const EXTRACTABLE_CARD_DOCUMENT_FILE_TYPES = [
  PHOTO_ID_FRONT_ID,
  INSURANCE_CARD_FRONT_ID,
  INSURANCE_CARD_BACK_ID,
  INSURANCE_CARD_FRONT_2_ID,
  INSURANCE_CARD_BACK_2_ID,
] as const;

export type ExtractableCardDocumentFileType = (typeof EXTRACTABLE_CARD_DOCUMENT_FILE_TYPES)[number];

/**
 * The extraction field shape a given card slot yields: photo-ID fields for the photo ID
 * front, insurance-card fields for the four insurance card image slots.
 */
export type CardExtractionFieldsFor<T extends ExtractableCardDocumentFileType> = T extends typeof PHOTO_ID_FRONT_ID
  ? PhotoIdExtractionFields
  : InsuranceCardExtractionFields;

export interface GetCardExtractionInput {
  appointmentID: string;
  /** The paperwork linkId of the card image slot (= DocumentReference content.attachment.title). */
  cardType: ExtractableCardDocumentFileType;
}

/**
 * - `pending` — no DocumentReference for the slot yet, or it exists but the async OCR
 *   extraction has not landed on it (keep polling)
 * - `ready` — extraction stored with at least one usable field (terminal)
 * - `not-a-card` — OCR verdict: the image is not an insurance card / photo ID (terminal)
 * - `unreadable` — OCR ran but produced nothing usable (terminal)
 */
export type CardExtractionStatus = 'ready' | 'pending' | 'not-a-card' | 'unreadable';

export interface GetCardExtractionResponse {
  status: CardExtractionStatus;
  /**
   * Present only when status is 'ready': InsuranceCardExtractionFields for the insurance card
   * slots, PhotoIdExtractionFields for the photo ID front (see CardExtractionFieldsFor).
   */
  fields?: InsuranceCardExtractionFields | PhotoIdExtractionFields;
  /** Model used for the extraction; present only when status is 'ready'. */
  model?: string;
  /** ISO instant the extraction was stored; present only when status is 'ready'. */
  extractedAt?: string;
}
