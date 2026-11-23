import { Operation } from 'fast-json-patch';
import { DocumentReference, Extension } from 'fhir/r4b';
import { Secrets } from 'utils/lib/secrets';
import {
  INSURANCE_CARD_EXTRACTION_EXTENSION_URL,
  InsuranceCardExtraction,
  InsuranceCardExtractionFields,
} from 'utils/lib/types/data/documents';
import { invokeChatbotVertexAI } from '../../shared/ai';
import {
  assertBooleanClassifier,
  buildExtractionExtension as buildGenericExtractionExtension,
  buildExtractionPatchOperation as buildGenericExtractionPatchOperation,
  extractFieldsWithAllNullFold,
  getExistingExtraction as getGenericExistingExtraction,
} from '../card-extraction-shared/extraction-helpers';

export const EXTRACTION_PROMPT = `You are extracting data from an image for a healthcare record system.

First, decide whether the image is a health insurance card (front or back) and set "isInsuranceCard" accordingly. If the image is anything other than an insurance card (a photo of a person, an ID card, a blank page, an unrelated document, etc.), set "isInsuranceCard" to false and set every other field to null.

If it is an insurance card, extract exactly these fields, using ONLY values that are clearly printed on the card itself:
- payer: the insurance company / plan name as printed on the card
- memberFirstName, memberMiddleName, memberLastName: the member/subscriber's name split into its parts. IDs often print the name as "LAST, FIRST MIDDLE" or with the last name on its own line above the first — split the printed name into the separate fields; NEVER put the whole printed name into a single field.
- memberId: the member / subscriber ID
- groupNumber: the group number
- payerId: the electronic payer ID, if printed
- rxBin: the pharmacy RxBIN
- rxPcn: the pharmacy RxPCN
- rxGroup: the pharmacy RxGroup
- insuranceType: the plan type if printed (e.g. PPO, HMO, EPO, POS, Medicaid, Medicare)
- effectiveDate: the coverage effective date, formatted YYYY-MM-DD

TRICARE / U.S. military ID cards:
A TRICARE beneficiary usually shows a U.S. Department of Defense / Uniformed Services Identification and Privilege Card (a "Uniformed Services ID card", often with a CAC-style layout) instead of a card printed with an insurer's name. Treat such a card as a health insurance card (isInsuranceCard = true) and set payer to "TRICARE" and insuranceType to "TRICARE". It has two sides:
- FRONT: the cardholder's photo, printed name (usually "LAST, FIRST MIDDLE"), relationship (Spouse, Child, ...), sponsor status, pay grade, rank, branch, and an expiration date. There is NO benefits number on the front.
- BACK: a barcode, the sponsor's name and "Sponsor DoD ID", the cardholder's date of birth, "Beneficiary DoD ID", the "Benefits Number" (also called the DoD Benefits Number or DBN), and an "Effective Date".
Rules for these cards:
- memberId is ONLY the "Benefits Number" printed on the back (11 digits, sometimes printed with a hyphen before the last two digits, e.g. 123456789-02). Return its digits only, with no hyphen or spaces (e.g. 12345678902). If the image is the front, or the Benefits Number is not clearly printed, set memberId to null.
- NEVER use the "Beneficiary DoD ID", the "Sponsor DoD ID", an EDIPI, a Social Security number or the sponsor's number as memberId; they are 10-digit identity numbers, not benefits numbers, and a claim filed with them is denied.
- Member name (memberFirstName / memberMiddleName / memberLastName) is the cardholder's own printed name, taken from the FRONT. The "Sponsor Name" on the back is a different person (the service member) — do not use it as the member name. On the back, set the member name fields to null.
- effectiveDate comes from the back's "Effective Date" and is printed like 2019JUL01 — convert it to YYYY-MM-DD (2019-07-01). The "Expires" date on the front is NOT an effective date; do not use it.
- groupNumber, payerId, rxBin, rxPcn and rxGroup are not printed on these cards: set them to null.

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
    memberFirstName: { type: 'string', nullable: true },
    memberMiddleName: { type: 'string', nullable: true },
    memberLastName: { type: 'string', nullable: true },
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
    'memberFirstName',
    'memberMiddleName',
    'memberLastName',
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
  'memberFirstName',
  'memberMiddleName',
  'memberLastName',
  'memberId',
  'groupNumber',
  'payerId',
  'rxBin',
  'rxPcn',
  'rxGroup',
  'insuranceType',
  'effectiveDate',
];

const TRICARE_BENEFITS_NUMBER_LENGTH = 11;

/**
 * Safety net for the TRICARE rules in EXTRACTION_PROMPT. A TRICARE member ID is the 11-digit DoD
 * Benefits Number on the back of the ID card, printed like "123456789-02"; claims must use it
 * digits-only. The 10-digit DoD ID on the front is not a benefits number, and since the EHR merges
 * front over back (see mergeFrontBack), a DoD ID leaking into memberId would beat the real number
 * from the back — so any TRICARE memberId that isn't 11 digits once cleaned is dropped.
 */
function normalizeTricareMemberId(fields: InsuranceCardExtractionFields | null): InsuranceCardExtractionFields | null {
  if (!fields?.memberId) {
    return fields;
  }
  const isTricare = /tricare/i.test(fields.payer ?? '') || /tricare/i.test(fields.insuranceType ?? '');
  if (!isTricare) {
    return fields;
  }
  const digits = fields.memberId.replace(/[\s-]/g, '');
  const memberId = /^\d+$/.test(digits) && digits.length === TRICARE_BENEFITS_NUMBER_LENGTH ? digits : null;
  return { ...fields, memberId };
}

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

  const fields = normalizeTricareMemberId(
    extractFieldsWithAllNullFold<InsuranceCardExtractionFields>(parsed, EXTRACTION_FIELD_KEYS)
  );
  const readable = typeof parsed.readable === 'boolean' ? parsed.readable : null;

  // all-null extraction is a permanent no-op condition, same as notACard — readable is nulled
  // with it (a judgment about a card we store nothing for is not actionable)
  return { isInsuranceCard: true, fields, readable: fields ? readable : null };
}

export interface ModelInsuranceCardExtraction {
  isInsuranceCard: boolean;
  fields: InsuranceCardExtractionFields | null;
  readable: boolean | null;
  /** true when mimeType isn't an image/pdf we can even attempt to OCR — caller should treat as notACard */
  unsupportedContentType: boolean;
}

/**
 * The reusable "bytes in, fields out" core of insurance card OCR: no DocumentReference, no FHIR
 * I/O — just the model call and response parsing. Shared by the DocumentReference-backed
 * extraction below and by get-insurance-card-suggestions, which OCRs a just-uploaded image before
 * any DocumentReference exists. Throws on malformed model JSON (parseModelResponse) — callers
 * decide retry semantics.
 */
export async function extractInsuranceCardFieldsFromImage(
  bytes: Buffer,
  mimeType: string,
  secrets: Secrets | null
): Promise<ModelInsuranceCardExtraction> {
  if (!mimeType.startsWith('image/') && mimeType !== 'application/pdf') {
    return { isInsuranceCard: false, fields: null, readable: null, unsupportedContentType: true };
  }

  const rawModelResponse = await invokeChatbotVertexAI(
    [{ text: EXTRACTION_PROMPT }, { inlineData: { mimeType, data: bytes.toString('base64') } }],
    secrets,
    'extract-insurance-card',
    insuranceCardResponseSchema,
    undefined,
    { retryMode: 'sequential' }
  );
  const parsed = parseModelResponse(rawModelResponse);
  return { ...parsed, unsupportedContentType: false };
}

export interface ExistingExtraction {
  extraction: InsuranceCardExtraction | null;
  /** Index of our extension within docRef.extension, or -1 when absent. */
  extensionIndex: number;
}

/**
 * Reads a previously-stored extraction off the DocumentReference's extension array.
 * A malformed valueString is reported (captureException) and treated as absent so
 * re-extraction can overwrite it rather than crashing the caller.
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
 * image has been re-encoded in place (e.g. a manual rotate): contentType and size are updated
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
