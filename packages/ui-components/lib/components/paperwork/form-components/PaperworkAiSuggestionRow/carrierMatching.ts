import { Reference } from 'fhir/r4b';

/**
 * Ported from apps/ehr/src/features/visits/shared/components/patient/useInsuranceCardExtraction.ts
 * so intake's carrier suggestion matches the exact same payer directory and resolution rules the
 * EHR already uses. Keep the two in sync if the matching logic changes on either side.
 */

export const normalizeForComparison = (value: string | null | undefined, alphanumericOnly = false): string => {
  let normalized = (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
  if (alphanumericOnly) normalized = normalized.replace(/[^a-z0-9]/g, '');
  return normalized;
};

export interface CarrierCandidate {
  /** Payer display exactly as the carrier field's option list shows it. */
  label: string;
  /** The `{ reference, display }` shape the carrier reference field stores. */
  formValue: { reference: string; display: string };
}

export interface CarrierSuggestion {
  display: string;
  formValue: { reference: string; display: string } | null;
  comparable: string;
  candidates?: CarrierCandidate[];
  pickerTitle?: string;
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
        // One-click resolutions display the resolved directory label ("PAYERID - Name"), not the
        // raw card text, so the chip shows exactly what "+" writes.
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
