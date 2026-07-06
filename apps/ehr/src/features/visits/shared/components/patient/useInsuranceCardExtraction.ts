import { useQuery } from '@tanstack/react-query';
import { DocumentReference } from 'fhir/r4b';
import { useApiClients } from 'src/hooks/useAppClients';
import {
  DocumentType,
  INSURANCE_CARD_CODE,
  INSURANCE_CARD_EXTRACTION_EXTENSION_URL,
  InsuranceCardExtraction,
  InsuranceCardExtractionFields,
  InsuranceQuickPickData,
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

/**
 * Carrier is suggested by NAME only (no payer-ID resolution). When the extracted payer
 * name uniquely matches the loaded payer list, accepting writes the `{ reference, display }`
 * shape the carrier field stores (same write as the carrier quick picks); otherwise the
 * suggestion is informational and the user picks via the existing carrier picker.
 */
export const buildCarrierSuggestion = (
  payer: string | null | undefined,
  payerOptions: InsuranceQuickPickData[]
): CardFieldSuggestion | null => {
  if (!payer) return null;
  const target = normalizeForComparison(payer);
  const matches = payerOptions.filter((option) => {
    if (normalizeForComparison(option.name) === target) return true;
    // Option names may carry a "PAYERID - " prefix (prependIdentifier); match without it too.
    if (option.payerId && option.name.toLowerCase().startsWith(option.payerId.toLowerCase())) {
      const nameWithoutId = option.name.slice(option.payerId.length).replace(/^\s*-\s*/, '');
      if (normalizeForComparison(nameWithoutId) === target) return true;
    }
    return false;
  });
  if (matches.length === 1) {
    const pick = matches[0];
    return {
      display: payer,
      formValue: { reference: pick.organizationReference, display: pick.name },
      comparable: pick.name,
    };
  }
  return { display: payer, formValue: null, comparable: payer };
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
 */
export const buildAdditionalInfoSuggestion = (
  fields: InsuranceCardExtractionFields,
  planTypeMapped: boolean
): string | null => {
  const parts: string[] = [];
  if (fields.groupNumber) parts.push(`Group #: ${fields.groupNumber}`);
  if (fields.rxBin) parts.push(`RxBIN: ${fields.rxBin}`);
  if (fields.rxPcn) parts.push(`RxPCN: ${fields.rxPcn}`);
  if (fields.rxGroup) parts.push(`RxGroup: ${fields.rxGroup}`);
  if (fields.payerId) parts.push(`Payer ID: ${fields.payerId}`);
  if (fields.effectiveDate) parts.push(`Effective: ${fields.effectiveDate}`);
  if (!planTypeMapped && fields.insuranceType) parts.push(`Plan type: ${fields.insuranceType}`);
  return parts.length > 0 ? parts.join('; ') : null;
};
