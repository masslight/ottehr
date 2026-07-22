import { captureException } from '@sentry/aws-serverless';
import { Operation } from 'fast-json-patch';
import { Extension } from 'fhir/r4b';
import { INSURANCE_CARD_EXTRACTION_EXTENSION_URL, InsuranceCardExtraction, InsuranceCardExtractionFields } from 'utils';

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
}

/**
 * Parses + normalizes the raw model JSON. Throws on malformed JSON (the caller treats that
 * as a transient, retryable failure). Non-string / empty field values normalize to null;
 * an all-null result is folded into fields=null so the caller writes the notACard marker.
 */
export function parseModelResponse(raw: string): ParsedModelResponse {
  const parsed = JSON.parse(raw);
  if (parsed == null || typeof parsed !== 'object' || typeof parsed.isInsuranceCard !== 'boolean') {
    throw new Error('Model response is not an object with a boolean isInsuranceCard field');
  }

  if (parsed.isInsuranceCard !== true) {
    return { isInsuranceCard: false, fields: null };
  }

  const fields = {} as InsuranceCardExtractionFields;
  let anyValue = false;
  for (const key of EXTRACTION_FIELD_KEYS) {
    const value = parsed[key];
    if (typeof value === 'string' && value.trim() !== '') {
      fields[key] = value.trim();
      anyValue = true;
    } else {
      fields[key] = null;
    }
  }

  // all-null extraction is a permanent no-op condition, same as notACard
  return { isInsuranceCard: true, fields: anyValue ? fields : null };
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
  const extensionIndex = (extensions ?? []).findIndex((ext) => ext.url === INSURANCE_CARD_EXTRACTION_EXTENSION_URL);
  if (extensionIndex < 0) {
    return { extraction: null, extensionIndex: -1 };
  }
  const valueString = extensions?.[extensionIndex]?.valueString;
  if (!valueString) {
    return { extraction: null, extensionIndex };
  }
  try {
    return { extraction: JSON.parse(valueString) as InsuranceCardExtraction, extensionIndex };
  } catch (error) {
    console.error('Malformed insurance-card-extraction extension found; it will be overwritten:', error);
    captureException(error);
    return { extraction: null, extensionIndex };
  }
}

export function buildExtractionExtension(extraction: InsuranceCardExtraction): Extension {
  return {
    url: INSURANCE_CARD_EXTRACTION_EXTENSION_URL,
    valueString: JSON.stringify(extraction),
  };
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
  const extension = buildExtractionExtension(extraction);
  if (extensions === undefined || extensions.length === 0) {
    return { op: 'add', path: '/extension', value: [extension] };
  }
  if (extensionIndex >= 0) {
    return { op: 'replace', path: `/extension/${extensionIndex}`, value: extension };
  }
  return { op: 'add', path: '/extension/-', value: extension };
}
