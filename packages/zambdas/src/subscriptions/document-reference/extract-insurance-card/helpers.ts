import { createHash } from 'node:crypto';
import { Operation } from 'fast-json-patch';
import { DocumentReference, Extension } from 'fhir/r4b';
import { INSURANCE_CARD_EXTRACTION_EXTENSION_URL, InsuranceCardExtraction, InsuranceCardExtractionFields } from 'utils';
import {
  assertBooleanClassifier,
  buildExtractionExtension as buildGenericExtractionExtension,
  buildExtractionPatchOperation as buildGenericExtractionPatchOperation,
  extractFieldsWithAllNullFold,
  getExistingExtraction as getGenericExistingExtraction,
} from '../shared/extraction-helpers';

/** sha256 hex of a Buffer. Uint8Array view (no copy): this workspace's @types/node rejects Buffer for BinaryLike. */
export function sha256Hex(data: Buffer): string {
  return createHash('sha256')
    .update(new Uint8Array(data.buffer, data.byteOffset, data.byteLength))
    .digest('hex');
}

export const EXTRACTION_PROMPT = `You are extracting data from an image for a healthcare record system.

First, decide whether the image is a health insurance card (front or back) and set "isInsuranceCard" accordingly. If the image is anything other than an insurance card (a photo of a person, an ID card, a blank page, an unrelated document, etc.), set "isInsuranceCard" to false and set every other field to null.

If it is an insurance card, extract exactly these fields, using ONLY values that are clearly printed on the card itself:
- payer: the insurance company / plan name as printed on the card
- memberName: the member or subscriber name
- memberId: the member / subscriber ID
- groupNumber: the group number
- payerId: the electronic payer ID, if printed
- rxBin: the pharmacy RxBIN
- rxPcn: the pharmacy RxPCN
- rxGroup: the pharmacy RxGroup
- insuranceType: the plan type if printed (e.g. PPO, HMO, EPO, POS, Medicaid, Medicare)
- effectiveDate: the coverage effective date, formatted YYYY-MM-DD

Also judge the card's orientation:
- readable: is the card RIGHT-SIDE-UP — is its printed text in a normal, upright, human-readable orientation (not rotated sideways or upside-down)? Return true if it is right-side-up, false if it is not.

Rules:
- Set a field to null when the value is not clearly printed on the card. Do NOT guess or infer values.
- Ignore a bare "80840" prefix printed before the member ID — it is the WEDI/NCPDP issuer identifier, not part of the member ID and not a payer ID.
- Do not borrow numbers or text from anything in the image that is not part of the insurance card itself (stickers, other documents, hands, backgrounds).
- Return JSON only.`;

// Vertex generateContent responseSchema (OpenAPI-style, same shape as the
// billing-suggestions precedent). isInsuranceCard first; all card fields nullable strings.
export const insuranceCardResponseSchema = {
  type: 'object',
  properties: {
    isInsuranceCard: { type: 'boolean' },
    payer: { type: 'string', nullable: true },
    memberName: { type: 'string', nullable: true },
    memberId: { type: 'string', nullable: true },
    groupNumber: { type: 'string', nullable: true },
    payerId: { type: 'string', nullable: true },
    rxBin: { type: 'string', nullable: true },
    rxPcn: { type: 'string', nullable: true },
    rxGroup: { type: 'string', nullable: true },
    insuranceType: { type: 'string', nullable: true },
    effectiveDate: { type: 'string', nullable: true },
    readable: { type: 'boolean', nullable: true },
  },
  required: [
    'isInsuranceCard',
    'payer',
    'memberName',
    'memberId',
    'groupNumber',
    'payerId',
    'rxBin',
    'rxPcn',
    'rxGroup',
    'insuranceType',
    'effectiveDate',
    'readable',
  ],
};

const EXTRACTION_FIELD_KEYS: (keyof InsuranceCardExtractionFields)[] = [
  'payer',
  'memberName',
  'memberId',
  'groupNumber',
  'payerId',
  'rxBin',
  'rxPcn',
  'rxGroup',
  'insuranceType',
  'effectiveDate',
];

export interface ParsedModelResponse {
  isInsuranceCard: boolean;
  /** Normalized fields; null when isInsuranceCard is false or nothing at all was extracted. */
  fields: InsuranceCardExtractionFields | null;
  /**
   * The model's right-side-up / human-readable judgment for the card. Null whenever fields is
   * null (notACard / all-null extraction) or the model did not return a boolean — never fabricated.
   */
  readable: boolean | null;
}

/**
 * Parses + normalizes the raw model JSON. Throws on malformed JSON (the caller treats that
 * as a transient, retryable failure). Non-string / empty field values normalize to null;
 * an all-null result is folded into fields=null so the caller writes the notACard marker.
 */
export function parseModelResponse(raw: string): ParsedModelResponse {
  const parsed = assertBooleanClassifier(JSON.parse(raw), 'isInsuranceCard');

  if (parsed.isInsuranceCard !== true) {
    return { isInsuranceCard: false, fields: null, readable: null };
  }

  const fields = extractFieldsWithAllNullFold<InsuranceCardExtractionFields>(parsed, EXTRACTION_FIELD_KEYS);
  const readable = typeof parsed.readable === 'boolean' ? parsed.readable : null;

  // all-null extraction is a permanent no-op condition, same as notACard — readable is nulled
  // with it (a judgment about a card we store nothing for is not actionable)
  return { isInsuranceCard: true, fields, readable: fields ? readable : null };
}

export interface ExistingExtraction {
  extraction: InsuranceCardExtraction | null;
  /** Index of our extension within docRef.extension, or -1 when absent. */
  extensionIndex: number;
}

/**
 * Reads a previously-stored extraction off the DocumentReference's extension array.
 * A malformed valueString is reported (captureException) and treated as absent so
 * re-extraction can overwrite it rather than crashing the subscription.
 */
export function getExistingExtraction(extensions: Extension[] | undefined): ExistingExtraction {
  return getGenericExistingExtraction<InsuranceCardExtraction>(
    extensions,
    INSURANCE_CARD_EXTRACTION_EXTENSION_URL,
    'insurance-card-extraction'
  );
}

/**
 * Builds the JSON-patch operations that keep the attachment metadata honest after the stored
 * image has been normalized (re-encoded / resized) in place: contentType and size are updated
 * only when they actually differ from what the DocumentReference already carries.
 */
export function buildAttachmentMetadataOperations(
  documentReference: DocumentReference,
  contentType: string,
  size: number
): Operation[] {
  const attachment = documentReference.content?.[0]?.attachment;
  if (!attachment) {
    return [];
  }
  const operations: Operation[] = [];
  if (attachment.contentType !== contentType) {
    operations.push({
      op: attachment.contentType === undefined ? 'add' : 'replace',
      path: '/content/0/attachment/contentType',
      value: contentType,
    });
  }
  if (attachment.size !== size) {
    operations.push({
      op: attachment.size === undefined ? 'add' : 'replace',
      path: '/content/0/attachment/size',
      value: size,
    });
  }
  return operations;
}

export function buildExtractionExtension(extraction: InsuranceCardExtraction): Extension {
  return buildGenericExtractionExtension(INSURANCE_CARD_EXTRACTION_EXTENSION_URL, extraction);
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
  extraction: InsuranceCardExtraction
): Operation {
  return buildGenericExtractionPatchOperation(
    INSURANCE_CARD_EXTRACTION_EXTENSION_URL,
    extensions,
    extensionIndex,
    extraction
  );
}
