import { QuestionnaireItemAnswerOption, QuestionnaireResponseItemAnswer } from 'fhir/r4b';
import {
  AllStatesToNames,
  AllStatesValues,
  EXTRACTABLE_CARD_DOCUMENT_FILE_TYPES,
  ExtractableCardDocumentFileType,
  InsuranceCardExtractionFields,
  PhotoIdExtractionFields,
} from 'utils';

// Target-field linkIds. No shared constants exist for these — raw linkIds are the codebase
// idiom (see prePopulation.ts) — so they are defined once here for the auto-fill engine.
export const INSURANCE_CARRIER_LINK_ID = 'insurance-carrier';
export const INSURANCE_CARRIER_2_LINK_ID = 'insurance-carrier-2';
export const INSURANCE_MEMBER_ID_LINK_ID = 'insurance-member-id';
export const INSURANCE_MEMBER_ID_2_LINK_ID = 'insurance-member-id-2';
export const PATIENT_STREET_ADDRESS_LINK_ID = 'patient-street-address';
export const PATIENT_CITY_LINK_ID = 'patient-city';
export const PATIENT_STATE_LINK_ID = 'patient-state';
export const PATIENT_ZIP_LINK_ID = 'patient-zip';

export const isExtractableCardSlot = (linkId: string): linkId is ExtractableCardDocumentFileType => {
  return (EXTRACTABLE_CARD_DOCUMENT_FILE_TYPES as readonly string[]).includes(linkId);
};

/** One value the engine wants to write into the form: the target item's linkId + its answer. */
export interface CardFill {
  linkId: string;
  answer: QuestionnaireResponseItemAnswer[];
}

/**
 * Comparison normalization for card matching: trim + collapse whitespace + case-insensitive;
 * with alphanumericOnly, non-alphanumerics are stripped too ("Blue Cross Blue Shield" matches
 * "BlueCross BlueShield"). Mirrors the EHR's normalizeForComparison (apps/ehr — not importable
 * from intake).
 */
export const normalizeForComparison = (value: string | null | undefined, alphanumericOnly = false): string => {
  let normalized = (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
  if (alphanumericOnly) normalized = normalized.replace(/[^a-z0-9]/g, '');
  return normalized;
};

/**
 * get-patient-insurance-payers builds each option's valueReference.reference with
 * `oystehr.rcm.constructPayerUrl({ id: payerId })` — `<rcm-api>/payer/<payerId>` — so the
 * payer ID is the reference URL's last path segment.
 */
export const payerIdFromOptionReference = (reference: string): string | null => {
  const segments = reference.split('/').filter(Boolean);
  const last = segments[segments.length - 1];
  return last || null;
};

export type CarrierMatchResult =
  | { kind: 'match'; valueReference: { reference: string; display: string } }
  | { kind: 'hint'; carrierName: string };

/**
 * Matches the OCR'd carrier against the carrier field's own loaded payer options,
 * payer-ID first (exact, case-insensitive — EDI ids are opaque codes, never fuzzy), then by
 * normalized name. The synthetic "Other" option (valueReference.type === 'other') is never
 * matched — an unresolved carrier surfaces the card's carrier NAME as a hint for the patient
 * instead of silently picking "Other". Returns null when there is nothing to go on (no
 * payer/payerId extracted, or an ID-only extraction that matched nothing).
 */
export const matchCarrierToOptions = (
  payer: string | null | undefined,
  payerId: string | null | undefined,
  options: QuestionnaireItemAnswerOption[]
): CarrierMatchResult | null => {
  if (!payer && !payerId) return null;
  const usable = options
    .map((option) => option.valueReference)
    .filter(
      (ref): ref is { reference: string; display: string; type?: string } =>
        Boolean(ref?.reference && ref?.display) && ref?.type !== 'other'
    );

  const toMatch = (ref: { reference: string; display: string }): CarrierMatchResult => ({
    kind: 'match',
    valueReference: { reference: ref.reference, display: ref.display },
  });

  // 1. Payer ID first
  const idTarget = normalizeForComparison(payerId);
  if (idTarget) {
    const idMatches = usable.filter(
      (ref) => normalizeForComparison(payerIdFromOptionReference(ref.reference)) === idTarget
    );
    if (idMatches.length === 1) return toMatch(idMatches[0]);
    if (idMatches.length > 1 && payer) {
      // several plans share the payer ID — disambiguate by name within the ID matches
      const nameTarget = normalizeForComparison(payer, true);
      const nameMatches = idMatches.filter((ref) => normalizeForComparison(ref.display, true) === nameTarget);
      if (nameMatches.length === 1) return toMatch(nameMatches[0]);
      return { kind: 'hint', carrierName: payer };
    }
    // zero ID matches → fall through to name matching
  }

  // 2. Name matching
  if (!payer) return null;
  const target = normalizeForComparison(payer, true);
  const nameMatches = usable.filter((ref) => normalizeForComparison(ref.display, true) === target);
  if (nameMatches.length === 1) return toMatch(nameMatches[0]);
  return { kind: 'hint', carrierName: payer };
};

/**
 * Maps an OCR'd state to the two-letter code the patient-state choice field stores: the code
 * itself (any case) or the full state name. No match → null (leave the field alone).
 */
export const matchStateOption = (extracted: string | null | undefined): string | null => {
  if (!extracted) return null;
  const trimmed = extracted.trim();
  const upper = trimmed.toUpperCase();
  if ((AllStatesValues as string[]).includes(upper)) return upper;
  const byName = Object.entries(AllStatesToNames).find(([, name]) => name.toLowerCase() === trimmed.toLowerCase());
  return byName ? byName[0] : null;
};

/**
 * Normalizes an OCR'd ZIP to the digits-only form the manual ZIP input stores (zipRegex allows
 * 5 or 9 digits). Anything else → null (leave the field alone).
 */
export const normalizeZipForFill = (zip: string | null | undefined): string | null => {
  if (!zip) return null;
  const digits = zip.replace(/[^0-9]/g, '');
  return digits.length === 5 || digits.length === 9 ? digits : null;
};

/**
 * Field-wise merge with front precedence: the back of an insurance card only contributes a
 * value the front left null.
 */
export const mergeInsuranceFields = (
  front: InsuranceCardExtractionFields | null,
  back: InsuranceCardExtractionFields | null
): InsuranceCardExtractionFields | null => {
  if (!front) return back;
  if (!back) return front;
  const merged = { ...back };
  (Object.keys(front) as (keyof InsuranceCardExtractionFields)[]).forEach((key) => {
    if (front[key] != null) merged[key] = front[key];
  });
  return merged;
};

/** photo-id-front → the contact-information-page address fields (name/DOB/sex are pre-paperwork). */
export const buildPhotoIdFills = (fields: PhotoIdExtractionFields): CardFill[] => {
  const fills: CardFill[] = [];
  if (fields.addressLine1) {
    fills.push({ linkId: PATIENT_STREET_ADDRESS_LINK_ID, answer: [{ valueString: fields.addressLine1 }] });
  }
  if (fields.addressCity) {
    fills.push({ linkId: PATIENT_CITY_LINK_ID, answer: [{ valueString: fields.addressCity }] });
  }
  const state = matchStateOption(fields.addressState);
  if (state) {
    fills.push({ linkId: PATIENT_STATE_LINK_ID, answer: [{ valueString: state }] });
  }
  const zip = normalizeZipForFill(fields.addressZip);
  if (zip) {
    fills.push({ linkId: PATIENT_ZIP_LINK_ID, answer: [{ valueString: zip }] });
  }
  return fills;
};

export interface InsuranceFillPlan {
  fills: CardFill[];
  /** Set when the OCR'd carrier could not be matched to a payer option: the hint to surface. */
  carrierHint: { linkId: string; carrierName: string } | null;
}

/**
 * insurance-card-front → insurance-carrier (matched valueReference) + insurance-member-id;
 * "-2" targets for the secondary ordinal. Carrier matching/hinting is skipped entirely until
 * the payer options have loaded (options === undefined) so a slow options fetch never
 * mis-reports "no match".
 */
export const buildInsuranceFills = (
  fields: InsuranceCardExtractionFields,
  options: QuestionnaireItemAnswerOption[] | undefined,
  ordinal: 'primary' | 'secondary'
): InsuranceFillPlan => {
  const carrierLinkId = ordinal === 'primary' ? INSURANCE_CARRIER_LINK_ID : INSURANCE_CARRIER_2_LINK_ID;
  const memberIdLinkId = ordinal === 'primary' ? INSURANCE_MEMBER_ID_LINK_ID : INSURANCE_MEMBER_ID_2_LINK_ID;
  const fills: CardFill[] = [];
  let carrierHint: InsuranceFillPlan['carrierHint'] = null;

  if (fields.memberId) {
    fills.push({ linkId: memberIdLinkId, answer: [{ valueString: fields.memberId }] });
  }
  if (options !== undefined) {
    const match = matchCarrierToOptions(fields.payer, fields.payerId, options);
    if (match?.kind === 'match') {
      fills.push({ linkId: carrierLinkId, answer: [{ valueReference: match.valueReference }] });
    } else if (match?.kind === 'hint') {
      carrierHint = { linkId: carrierLinkId, carrierName: match.carrierName };
    }
  }
  return { fills, carrierHint };
};

/** Reads a dotted react-hook-form path ("secondary-insurance.item.2") out of a nested object. */
export const readAtPath = (obj: unknown, path: string): unknown => {
  return path.split('.').reduce<any>((accum, part) => (accum == null ? undefined : accum[part]), obj);
};

const hasTruthyLeaf = (node: unknown): boolean => {
  if (!node) return false;
  if (node === true) return true;
  if (Array.isArray(node)) return node.some(hasTruthyLeaf);
  if (typeof node === 'object') return Object.values(node).some(hasTruthyLeaf);
  return Boolean(node);
};

/**
 * The clobber guard: true when the patient has actively edited the field this session — any
 * truthy leaf under the field's path in dirtyFields (user input via Controller onChange) or
 * touchedFields (blur). The engine's own setValue calls never set dirty/touched, so engine
 * fills do not trip this.
 */
export const isFieldUserEdited = (dirtyFields: unknown, touchedFields: unknown, fieldId: string): boolean => {
  return hasTruthyLeaf(readAtPath(dirtyFields, fieldId)) || hasTruthyLeaf(readAtPath(touchedFields, fieldId));
};
