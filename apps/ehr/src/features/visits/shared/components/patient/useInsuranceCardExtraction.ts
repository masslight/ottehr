import { useQuery } from '@tanstack/react-query';
import { DocumentReference, Reference } from 'fhir/r4b';
import { useApiClients } from 'src/hooks/useAppClients';
import {
  DocumentType,
  INSURANCE_CARD_CODE,
  INSURANCE_CARD_EXTRACTION_EXTENSION_URL,
  InsuranceCardExtraction,
  InsuranceCardExtractionFields,
  LOINC_SYSTEM,
} from 'utils';

type CardOrdinal = 'primary' | 'secondary';
type CardFace = 'front' | 'back';
type CardSlotKey = `${CardOrdinal}-${CardFace}`;

// content[0].attachment.title identifies the card slot; "-2" titles are the secondary insurance.
const CARD_SLOT_BY_TITLE: Partial<Record<string, { ordinal: CardOrdinal; face: CardFace }>> = {
  [DocumentType.InsuranceFront]: { ordinal: 'primary', face: 'front' },
  [DocumentType.InsuranceBack]: { ordinal: 'primary', face: 'back' },
  [DocumentType.InsuranceFrontSecondary]: { ordinal: 'secondary', face: 'front' },
  [DocumentType.InsuranceBackSecondary]: { ordinal: 'secondary', face: 'back' },
};

export interface MergedCardExtractions {
  primary: InsuranceCardExtractionFields | null;
  secondary: InsuranceCardExtractionFields | null;
}

export interface UseInsuranceCardExtractionResult extends MergedCardExtractions {
  isLoading: boolean;
}

const readStoredExtraction = (docRef: DocumentReference): InsuranceCardExtraction | null => {
  const valueString = docRef.extension?.find((ext) => ext.url === INSURANCE_CARD_EXTRACTION_EXTENSION_URL)?.valueString;
  if (!valueString) return null;
  try {
    return JSON.parse(valueString) as InsuranceCardExtraction;
  } catch (error) {
    // Malformed extension: ignore this DocRef rather than crash the form.
    console.error(`Malformed insurance-card-extraction extension on DocumentReference/${docRef.id}; ignoring`, error);
    return null;
  }
};

const mergeFrontBack = (
  front: InsuranceCardExtractionFields | undefined,
  back: InsuranceCardExtractionFields | undefined
): InsuranceCardExtractionFields | null => {
  if (!front && !back) return null;
  if (!front) return back ?? null;
  if (!back) return front;
  // Field-wise merge with front precedence: the front carries member ID / carrier / plan;
  // the back typically contributes only Rx BIN/PCN/Group.
  const merged = { ...back };
  (Object.keys(front) as (keyof InsuranceCardExtractionFields)[]).forEach((key) => {
    if (front[key] != null) merged[key] = front[key];
  });
  return merged;
};

/**
 * Groups stored card extractions by insurance ordinal (primary vs "-2" secondary titles),
 * keeps the newest DocRef per slot (input is expected newest-first), drops notACard /
 * empty extractions, and merges front + back field-wise with front precedence.
 *
 * Exported for tests.
 */
export const mergeCardExtractions = (docRefsNewestFirst: DocumentReference[]): MergedCardExtractions => {
  const bySlot: Partial<Record<CardSlotKey, InsuranceCardExtractionFields>> = {};
  for (const docRef of docRefsNewestFirst) {
    const title = docRef.content?.[0]?.attachment?.title;
    const slot = title ? CARD_SLOT_BY_TITLE[title] : undefined;
    if (!slot) continue; // photo-ID / full-card-PDF titles carry no per-slot extraction
    const slotKey: CardSlotKey = `${slot.ordinal}-${slot.face}`;
    if (bySlot[slotKey]) continue; // newest DocRef per slot wins
    const extraction = readStoredExtraction(docRef);
    if (!extraction || extraction.notACard || !extraction.fields) continue;
    bySlot[slotKey] = extraction.fields;
  }
  return {
    primary: mergeFrontBack(bySlot['primary-front'], bySlot['primary-back']),
    secondary: mergeFrontBack(bySlot['secondary-front'], bySlot['secondary-back']),
  };
};

/**
 * Reads the OCR extraction the extract-insurance-card zambda stored on the patient's
 * current insurance-card DocumentReferences. Read-only: OCR is never invoked here — a
 * card either has the extension (suggestions render), has a notACard marker, or has no
 * extension yet (extraction in flight / failed), in which case nothing renders.
 */
export const useInsuranceCardExtraction = (patientId: string | undefined): UseInsuranceCardExtractionResult => {
  const { oystehr } = useApiClients();
  const enabled = Boolean(oystehr && patientId);
  const { data, isLoading } = useQuery({
    queryKey: ['insurance-card-extraction', patientId],
    queryFn: async (): Promise<MergedCardExtractions> => {
      const bundle = await oystehr!.fhir.search<DocumentReference>({
        resourceType: 'DocumentReference',
        params: [
          { name: 'status', value: 'current' },
          { name: 'related', value: `Patient/${patientId}` },
          { name: 'type', value: `${LOINC_SYSTEM}|${INSURANCE_CARD_CODE}` },
          { name: '_sort', value: '-_lastUpdated' },
        ],
      });
      return mergeCardExtractions(bundle.unbundle());
    },
    enabled,
  });
  return { primary: data?.primary ?? null, secondary: data?.secondary ?? null, isLoading: enabled && isLoading };
};

/**
 * Shared comparison normalization for card suggestions: trim + collapse whitespace +
 * case-insensitive. With alphanumericOnly, non-alphanumerics are stripped too (member
 * IDs: "W123-456" and "W123456" compare equal).
 */
export const normalizeForComparison = (value: string | null | undefined, alphanumericOnly = false): string => {
  let normalized = (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
  if (alphanumericOnly) normalized = normalized.replace(/[^a-z0-9]/g, '');
  return normalized;
};

export interface CardFieldSuggestion {
  /** Human-readable value as printed on the card. */
  display: string;
  /** Value written to the form on accept; null = informational only (no "+"). */
  formValue: unknown | null;
  /** String the live form value is compared against. */
  comparable: string;
}

export interface CarrierCandidate {
  /** Payer display exactly as the carrier field's option list shows it. */
  label: string;
  /** The `{ reference, display }` shape the carrier reference field stores. */
  formValue: { reference: string; display: string };
}

export interface CarrierSuggestion extends CardFieldSuggestion {
  /**
   * Ranked fuzzy candidates for the picker; present (possibly empty) only when the extracted
   * name did not strong-match exactly one payer.
   */
  candidates?: CarrierCandidate[];
  /** Popover title override for the picker (e.g. when candidates come from a payer-ID match). */
  pickerTitle?: string;
  /** True when the suggestion was resolved by an exact payer-ID match against a single payer. */
  resolvedByPayerId?: boolean;
}

// Option displays carry a "PAYERID - " prefix when the answer source uses prependIdentifier.
const PAYER_ID_SEPARATOR = ' - ';
const stripPayerIdPrefix = (display: string): string => {
  const separatorIndex = display.indexOf(PAYER_ID_SEPARATOR);
  return separatorIndex >= 0 ? display.slice(separatorIndex + PAYER_ID_SEPARATOR.length) : display;
};
const parsePayerIdPrefix = (display: string): string | null => {
  const separatorIndex = display.indexOf(PAYER_ID_SEPARATOR);
  return separatorIndex >= 0 ? display.slice(0, separatorIndex) : null;
};

/**
 * Suggests a carrier against the same payer option list the carrier reference field loads
 * (get-all-insurance-payers), payer-ID first, then by name:
 *
 * 1. Payer ID (when extracted): each option's ID is parsed from its "PAYERID - Name" display
 *    and compared exactly (trim + case-insensitive — an alphanumeric EDI id, never fuzzy).
 *    Exactly one match → one-click accept flagged `resolvedByPayerId`; several → the picker
 *    scoped to those ID matches; none → fall through to name matching.
 * 2. Name:
 *    - Strong match (all non-alphanumerics stripped, so "BlueCross BlueShield" equals
 *      "Blue Cross Blue Shield") against exactly one payer → one-click accept that writes the
 *      `{ reference, display }` shape the carrier field stores.
 *    - Otherwise → ranked fuzzy `candidates` (contains/token match) for the row's picker; an
 *      empty list surfaces the picker's "No matches found" state rather than a dead row.
 *
 * One-click resolutions (single ID or strong-name match) set `display` to the resolved
 * directory label ("PAYERID - Name") — exactly what accepting writes. Picker branches keep
 * the raw extracted term as the clickable text.
 */
export const buildCarrierSuggestion = (
  payer: string | null | undefined,
  payerId: string | null | undefined,
  payerOptions: Reference[]
): CarrierSuggestion | null => {
  if (!payer && !payerId) return null;
  const usableOptions = payerOptions.filter((option): option is Reference & { reference: string; display: string } =>
    Boolean(option.reference && option.display)
  );

  // 1. Payer-ID-first resolution: exact (case-insensitive) equality against the "PAYERID - "
  // prefix of each option display. EDI ids are opaque codes — no fuzzy matching.
  const idTarget = normalizeForComparison(payerId);
  if (idTarget) {
    const idMatches = usableOptions.filter((option) => {
      const optionPayerId = parsePayerIdPrefix(option.display);
      return optionPayerId != null && normalizeForComparison(optionPayerId) === idTarget;
    });
    if (idMatches.length === 1) {
      const pick = idMatches[0];
      return {
        // One-click resolutions display the resolved directory label ("PAYERID - Name"),
        // not the raw card text, so the pill shows exactly what "+" writes.
        display: pick.display,
        formValue: { reference: pick.reference, display: pick.display },
        comparable: pick.display,
        resolvedByPayerId: true,
      };
    }
    if (idMatches.length > 1) {
      return {
        display: payer ?? payerId!,
        formValue: null,
        comparable: payer ?? payerId!,
        pickerTitle: `Payers for ID '${payerId}'`,
        candidates: idMatches.map((option) => ({
          label: option.display,
          formValue: { reference: option.reference, display: option.display },
        })),
      };
    }
    // Zero ID matches → fall through to name matching below.
  }

  // 2. Name matching (no payer ID extracted, or it matched nothing in the directory).
  if (!payer) return null;
  const target = normalizeForComparison(payer, true);

  const strongMatches = usableOptions.filter(
    (option) =>
      normalizeForComparison(option.display, true) === target ||
      normalizeForComparison(stripPayerIdPrefix(option.display), true) === target
  );
  if (strongMatches.length === 1) {
    const pick = strongMatches[0];
    return {
      // As with the payer-ID resolution above: show the resolved directory label, which is
      // what accepting writes (e.g. "00390 - TN BCBS" rather than "BlueCross BlueShield").
      display: pick.display,
      formValue: { reference: pick.reference, display: pick.display },
      comparable: pick.display,
    };
  }

  // No unique strong match → rank fuzzy candidates: exact > contains > token overlap.
  const targetTokens = Array.from(
    new Set(
      payer
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length >= 3)
    )
  );
  const scored = usableOptions
    .map((option) => {
      const nameNormalized = normalizeForComparison(stripPayerIdPrefix(option.display), true);
      let score = 0;
      if (target && nameNormalized === target) {
        score = 100;
      } else if (target && nameNormalized && (nameNormalized.includes(target) || target.includes(nameNormalized))) {
        score = 75;
      } else if (targetTokens.length > 0) {
        const matchedTokens = targetTokens.filter((token) => nameNormalized.includes(token));
        if (matchedTokens.length > 0) score = 50 * (matchedTokens.length / targetTokens.length);
      }
      return { option, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.option.display.localeCompare(b.option.display));

  return {
    display: payer,
    formValue: null,
    comparable: payer,
    candidates: scored.map(({ option }) => ({
      label: option.display,
      formValue: { reference: option.reference, display: option.display },
    })),
  };
};

/**
 * Maps the extracted plan-type token (e.g. "PPO") to an insurance-plan-type option by
 * case-insensitive exact match against the option label suffix ("12 - PPO" → candidCode
 * "12"). No match → no suggestion; the raw token flows into additional information.
 */
export const buildPlanTypeSuggestion = (
  insuranceType: string | null | undefined,
  options: { label: string; value: string }[] | undefined
): CardFieldSuggestion | null => {
  if (!insuranceType || !options?.length) return null;
  const target = normalizeForComparison(insuranceType);
  const match = options.find((option) => {
    const separatorIndex = option.label.indexOf(' - ');
    const labelSuffix = separatorIndex >= 0 ? option.label.slice(separatorIndex + 3) : option.label;
    return normalizeForComparison(labelSuffix) === target;
  });
  if (!match) return null;
  return { display: insuranceType, formValue: match.value, comparable: match.value };
};

/**
 * Composes the additional-information suggestion from the extracted values that have no
 * dedicated form field (group / Rx / payer ID / effective date, plus an unmapped plan type).
 * The payer ID is included only when the carrier suggestion did NOT already resolve it
 * (ambiguous/unmatched IDs stay here so they aren't lost), mirroring `planTypeMapped`.
 *
 * Unlike the other card-field suggestions, this field is free text staff may already have
 * written notes into — accepting must never destroy that. `formValue` therefore APPENDS the
 * card-derived text to whatever is already in the field (comparing against `currentValue`)
 * rather than replacing it outright. `comparable` stays just the card-derived text so the
 * caller can detect "already appended" via substring containment, not full-value equality.
 */
export const buildAdditionalInfoSuggestion = (
  fields: InsuranceCardExtractionFields,
  planTypeMapped: boolean,
  carrierResolvedByPayerId: boolean,
  currentValue: string | null | undefined
): CardFieldSuggestion | null => {
  const parts: string[] = [];
  if (fields.groupNumber) parts.push(`Group #: ${fields.groupNumber}`);
  if (fields.rxBin) parts.push(`RxBIN: ${fields.rxBin}`);
  if (fields.rxPcn) parts.push(`RxPCN: ${fields.rxPcn}`);
  if (fields.rxGroup) parts.push(`RxGroup: ${fields.rxGroup}`);
  if (fields.payerId && !carrierResolvedByPayerId) parts.push(`Payer ID: ${fields.payerId}`);
  if (fields.effectiveDate) parts.push(`Effective: ${fields.effectiveDate}`);
  if (!planTypeMapped && fields.insuranceType) parts.push(`Plan type: ${fields.insuranceType}`);
  if (parts.length === 0) return null;

  const cardText = parts.join('; ');
  const existing = (currentValue ?? '').trim();
  return {
    display: cardText,
    formValue: existing ? `${existing}; ${cardText}` : cardText,
    comparable: cardText,
  };
};
