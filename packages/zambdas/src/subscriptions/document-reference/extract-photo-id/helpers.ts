import { Operation } from 'fast-json-patch';
import { Extension } from 'fhir/r4b';
import { PHOTO_ID_EXTRACTION_EXTENSION_URL, PhotoIdExtraction, PhotoIdExtractionFields } from 'utils';
import {
  assertBooleanClassifier,
  buildExtractionExtension as buildGenericExtractionExtension,
  buildExtractionPatchOperation as buildGenericExtractionPatchOperation,
  extractFieldsWithAllNullFold,
  getExistingExtraction as getGenericExistingExtraction,
} from '../shared/extraction-helpers';

// same hashing helper the insurance-card pipeline uses — the two extractions share the audit-key format
export { sha256Hex } from '../extract-insurance-card/helpers';

export const EXTRACTION_PROMPT = `You are extracting data from an image for a healthcare record system.

First, decide whether the image is a US driver's license or state-issued photo identification card and set "isPhotoId" accordingly. If the image is anything other than a driver's license or state photo ID (an insurance card, a passport, a photo of a person, a blank page, an unrelated document, etc.), set "isPhotoId" to false and set every other field to null.

If it is a photo ID, extract exactly these fields, using ONLY values that are clearly printed on the ID itself:
- firstName, middleName, lastName, suffix: the holder's name split into its parts. IDs often print the name as "LAST, FIRST MIDDLE" or with the last name on its own line above the first — split the printed name into the separate fields; NEVER put the whole printed name into a single field. suffix is a generational suffix (JR, SR, II, III, ...) when printed.
- dateOfBirth: the date of birth (DOB), formatted YYYY-MM-DD
- sex: the sex as printed; normalize "M" to "Male" and "F" to "Female" when clear
- addressLine1: the street address line (number and street only, without city/state/ZIP)
- addressCity: the city
- addressState: the two-letter state abbreviation
- addressZip: the ZIP code
- licenseNumber: the license / ID number (often labeled DL, LIC, ID, DL NO, or 4d)
- expirationDate: the expiration date (EXP), formatted YYYY-MM-DD

Rules:
- Set a field to null when the value is not clearly printed on the ID. Do NOT guess or infer values.
- Do not borrow text from anything in the image that is not part of the ID card itself (stickers, other documents, hands, backgrounds).
- Return JSON only.`;

// Vertex generateContent responseSchema (OpenAPI-style, same shape as extract-insurance-card).
// isPhotoId first; all ID fields nullable strings.
export const photoIdResponseSchema = {
  type: 'object',
  properties: {
    isPhotoId: { type: 'boolean' },
    firstName: { type: 'string', nullable: true },
    middleName: { type: 'string', nullable: true },
    lastName: { type: 'string', nullable: true },
    suffix: { type: 'string', nullable: true },
    dateOfBirth: { type: 'string', nullable: true },
    sex: { type: 'string', nullable: true },
    addressLine1: { type: 'string', nullable: true },
    addressCity: { type: 'string', nullable: true },
    addressState: { type: 'string', nullable: true },
    addressZip: { type: 'string', nullable: true },
    licenseNumber: { type: 'string', nullable: true },
    expirationDate: { type: 'string', nullable: true },
  },
  required: [
    'isPhotoId',
    'firstName',
    'middleName',
    'lastName',
    'suffix',
    'dateOfBirth',
    'sex',
    'addressLine1',
    'addressCity',
    'addressState',
    'addressZip',
    'licenseNumber',
    'expirationDate',
  ],
};

const EXTRACTION_FIELD_KEYS: (keyof PhotoIdExtractionFields)[] = [
  'firstName',
  'middleName',
  'lastName',
  'suffix',
  'dateOfBirth',
  'sex',
  'addressLine1',
  'addressCity',
  'addressState',
  'addressZip',
  'licenseNumber',
  'expirationDate',
];

/** Belt-and-suspenders for the prompt's sex normalization: fold bare M/F through to Male/Female. */
function normalizeSex(value: string): string {
  const upper = value.toUpperCase();
  if (upper === 'M' || upper === 'MALE') return 'Male';
  if (upper === 'F' || upper === 'FEMALE') return 'Female';
  return value;
}

export interface ParsedModelResponse {
  isPhotoId: boolean;
  /** Normalized fields; null when isPhotoId is false or nothing at all was extracted. */
  fields: PhotoIdExtractionFields | null;
}

/**
 * Parses + normalizes the raw model JSON. Throws on malformed JSON (the caller treats that
 * as a transient, retryable failure). Non-string / empty field values normalize to null;
 * an all-null result is folded into fields=null so the caller writes the notAPhotoId marker.
 */
export function parseModelResponse(raw: string): ParsedModelResponse {
  const parsed = assertBooleanClassifier(JSON.parse(raw), 'isPhotoId');

  if (parsed.isPhotoId !== true) {
    return { isPhotoId: false, fields: null };
  }

  const fields = extractFieldsWithAllNullFold<PhotoIdExtractionFields>(parsed, EXTRACTION_FIELD_KEYS);
  if (fields?.sex) {
    fields.sex = normalizeSex(fields.sex);
  }

  // all-null extraction is a permanent no-op condition, same as notAPhotoId
  return { isPhotoId: true, fields };
}

export interface ExistingExtraction {
  extraction: PhotoIdExtraction | null;
  /** Index of our extension within docRef.extension, or -1 when absent. */
  extensionIndex: number;
}

/**
 * Reads a previously-stored extraction off the DocumentReference's extension array.
 * A malformed valueString is reported (captureException) and treated as absent so
 * re-extraction can overwrite it rather than crashing the subscription.
 */
export function getExistingExtraction(extensions: Extension[] | undefined): ExistingExtraction {
  return getGenericExistingExtraction<PhotoIdExtraction>(
    extensions,
    PHOTO_ID_EXTRACTION_EXTENSION_URL,
    'photo-id-extraction'
  );
}

export function buildExtractionExtension(extraction: PhotoIdExtraction): Extension {
  return buildGenericExtractionExtension(PHOTO_ID_EXTRACTION_EXTENSION_URL, extraction);
}

/**
 * Builds the single JSON-patch operation that stores the extraction on the DocumentReference:
 * - no extension array yet -> add /extension
 * - array exists, ours absent -> add /extension/-
 * - ours already present (stale / different attachment url) -> replace /extension/{i}
 */
export function buildExtractionPatchOperation(
  extensions: Extension[] | undefined,
  extensionIndex: number,
  extraction: PhotoIdExtraction
): Operation {
  return buildGenericExtractionPatchOperation(
    PHOTO_ID_EXTRACTION_EXTENSION_URL,
    extensions,
    extensionIndex,
    extraction
  );
}
