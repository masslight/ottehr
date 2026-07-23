export enum DocumentType {
  InsuranceFront = 'insurance-card-front',
  InsuranceBack = 'insurance-card-back',
  FullInsurance = 'fullInsuranceCard',
  InsuranceFrontSecondary = 'insurance-card-front-2',
  InsuranceBackSecondary = 'insurance-card-back-2',
  FullInsuranceSecondary = 'fullInsuranceCard-2',
  PhotoIdFront = 'photo-id-front',
  PhotoIdBack = 'photo-id-back',
  FullPhotoId = 'fullPhotoIDCard',
  HipaaConsent = 'HIPAA Acknowledgement',
  CttConsent = 'Consent to Treat, Guarantee of Payment & Card on File Agreement',
  CttConsentOld = 'Consent to Treat and Guarantee of Payment',
}
export interface DocumentInfo {
  id: string;
  type: DocumentType;
  z3Url: string;
  presignedUrl: string | undefined;
  code?: string;
}

export interface VisitDocuments {
  photoIdCards: DocumentInfo[];
  insuranceCards: DocumentInfo[];
  insuranceCardsSecondary: DocumentInfo[];
  fullCardPdfs: DocumentInfo[];
  consentPdfUrls: string[];
}

/**
 * Extension URL under which the extract-insurance-card zambda stores the OCR extraction
 * result (as a JSON string in valueString) on the insurance-card DocumentReference.
 */
export const INSURANCE_CARD_EXTRACTION_EXTENSION_URL = 'https://extensions.fhir.oystehr.com/insurance-card-extraction';

/**
 * The per-field OCR extraction result for a single insurance card image.
 * Every field is null when the value is not clearly printed on the card.
 */
export interface InsuranceCardExtractionFields {
  payer: string | null;
  memberName: string | null;
  memberId: string | null;
  groupNumber: string | null;
  payerId: string | null;
  rxBin: string | null;
  rxPcn: string | null;
  rxGroup: string | null;
  insuranceType: string | null;
  effectiveDate: string | null; // YYYY-MM-DD
}

/**
 * The JSON payload stored (stringified) in the INSURANCE_CARD_EXTRACTION_EXTENSION_URL
 * extension on an insurance-card DocumentReference by the extract-insurance-card zambda.
 * The EHR insurance form reads this — OCR is never invoked at read time.
 */
export interface InsuranceCardExtraction {
  version: 1;
  /** The model's verdict on whether the image is actually an insurance card. */
  isInsuranceCard: boolean;
  /**
   * True if the model judged the card right-side-up / human-readable (printed text in a normal,
   * upright orientation — not rotated sideways or upside-down) in the STORED image, i.e. after
   * EXIF normalization; false means the card still looks mis-oriented and may warrant a staff hint.
   * Null when not applicable (e.g. notACard / nothing extracted). Absent (undefined) on
   * extractions stored before this field existed — treat absent the same as null.
   */
  readable: boolean | null;
  /** null when notACard / skipped */
  fields: InsuranceCardExtractionFields | null;
  /** Permanent no-op marker: the image is not an insurance card (or unprocessable); render nothing. */
  notACard?: boolean;
  /** DocumentReference.id the extraction was performed against. */
  sourceDocRefId: string;
  /** z3 url of the extracted attachment — the cheap idempotency key for subscription re-fires. */
  sourceAttachmentUrl: string;
  /** sha256 hex of the image bytes — durable audit key. */
  imageHash: string;
  /** Model used for the extraction, e.g. 'gemini-3.1-flash-lite'. */
  model: string;
  /** ISO instant the extraction was stored. */
  extractedAt: string;
}

/**
 * Extension URL under which the extract-photo-id zambda stores the OCR extraction
 * result (as a JSON string in valueString) on the photo-ID DocumentReference.
 */
export const PHOTO_ID_EXTRACTION_EXTENSION_URL = 'https://extensions.fhir.oystehr.com/photo-id-extraction';

/**
 * The per-field OCR extraction result for a photo-ID (driver's license / state ID) front image.
 * Every field is null when the value is not clearly printed on the ID.
 */
export interface PhotoIdExtractionFields {
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  suffix: string | null;
  dateOfBirth: string | null; // YYYY-MM-DD
  /** Normalized to 'Male' / 'Female' when the printed value is clear (M/F). */
  sex: string | null;
  addressLine1: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressZip: string | null;
  licenseNumber: string | null;
  expirationDate: string | null; // YYYY-MM-DD
}

/**
 * The JSON payload stored (stringified) in the PHOTO_ID_EXTRACTION_EXTENSION_URL
 * extension on a photo-ID front DocumentReference by the extract-photo-id zambda.
 * Readers consume this stored result — OCR is never invoked at read time.
 */
export interface PhotoIdExtraction {
  version: 1;
  /** The model's verdict on whether the image is actually a US driver's license / state photo ID. */
  isPhotoId: boolean;
  /** null when notAPhotoId / skipped */
  fields: PhotoIdExtractionFields | null;
  /** Permanent no-op marker: the image is not a photo ID (or unprocessable); render nothing. */
  notAPhotoId?: boolean;
  /** DocumentReference.id the extraction was performed against. */
  sourceDocRefId: string;
  /** z3 url of the extracted attachment — the cheap idempotency key for subscription re-fires. */
  sourceAttachmentUrl: string;
  /** sha256 hex of the image bytes — durable audit key. */
  imageHash: string;
  /** Model used for the extraction, e.g. 'gemini-3.1-flash-lite'. */
  model: string;
  /** ISO instant the extraction was stored. */
  extractedAt: string;
}

/** The clockwise rotation angles the rotate-insurance-card-image zambda accepts. */
export const INSURANCE_CARD_ROTATION_DEGREES = [90, 180, 270] as const;
export type InsuranceCardRotationDegrees = (typeof INSURANCE_CARD_ROTATION_DEGREES)[number];

/** Input for the staff-triggered rotate-insurance-card-image zambda. */
export interface RotateInsuranceCardImageInput {
  documentReferenceId: string;
  /** CLOCKWISE rotation to bake into the stored card image. */
  rotationDegrees: InsuranceCardRotationDegrees;
}

export interface RotateInsuranceCardImageResponse {
  documentReferenceId: string;
  rotated: boolean;
}
