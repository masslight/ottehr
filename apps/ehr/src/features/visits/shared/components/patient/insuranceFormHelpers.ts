import { useEffect, useRef } from 'react';
import type { UseFormReturn } from 'react-hook-form';

/**
 * Builds the `renderedSectionCounts` map the dynamic validation resolver uses
 * to decide which insurance section rows to validate. The count for both
 * `insurance-section` and `insurance-section-2` is the same value: the number
 * of insurance ordinal slots that are actually on screen.
 *
 * Pulled out of `PatientInformationPage` so the InsuranceSection test harness
 * can exercise the same wiring rather than duplicate the bookkeeping.
 */
export const buildInsuranceSectionCounts = ({
  hasPrimary,
  hasSecondary,
  isAddingInsurance,
  newInsuranceOrdinal,
}: {
  hasPrimary: boolean;
  hasSecondary: boolean;
  isAddingInsurance?: boolean;
  newInsuranceOrdinal?: number;
}): Record<string, number> => {
  // Highest ordinal index (0-based) that's rendered, defaulting to -1 when none.
  let maxInsuranceIndex = Math.max(hasPrimary ? 0 : -1, hasSecondary ? 1 : -1);
  if (isAddingInsurance && newInsuranceOrdinal !== undefined) {
    maxInsuranceIndex = Math.max(maxInsuranceIndex, newInsuranceOrdinal - 1);
  }
  // -1 → 0; index N → count N+1.
  const insuranceCount = maxInsuranceIndex + 1;
  return {
    'insurance-section': insuranceCount,
    'insurance-section-2': insuranceCount,
  };
};

const isEmptyValue = (v: unknown): boolean =>
  v === undefined ||
  v === null ||
  v === '' ||
  (typeof v === 'object' && v !== null && Object.keys(v as object).length === 0);

/**
 * Rehydrates form fields from refetched coverage data, using `resetField` so
 * the loaded values become the form's defaultValues (matching what masked
 * inputs re-emit on mount; without this RHF flags them dirty).
 *
 * For a coverage that *just appeared* (e.g. a per-section save → refetch),
 * any non-empty in-form value is preserved when the mapping returns empty —
 * the backend round-trip can drop fields before resources are fully indexed,
 * and we don't want to wipe values the user just saved.
 *
 * Keyed on the (patient, primaryCoverageId, secondaryCoverageId) tuple so the
 * effect re-runs when the coverage set genuinely changes (e.g. removal) and
 * stays quiet on unrelated refetches.
 */
export const useCoverageFormRehydration = ({
  coveragesFormValues,
  patientId,
  primaryCoverageId,
  secondaryCoverageId,
  methods,
}: {
  coveragesFormValues: Record<string, unknown> | undefined;
  patientId: string | undefined;
  primaryCoverageId: string | undefined;
  secondaryCoverageId: string | undefined;
  methods: UseFormReturn<any>;
}): void => {
  const coverageInitKeyRef = useRef<string>('');
  useEffect(() => {
    if (!coveragesFormValues || Object.keys(coveragesFormValues).length === 0) return;
    const coverageKey = [patientId ?? 'none', primaryCoverageId ?? 'none', secondaryCoverageId ?? 'none'].join(':');
    if (coverageInitKeyRef.current === coverageKey) return;
    const previousKey = coverageInitKeyRef.current;
    coverageInitKeyRef.current = coverageKey;

    const split = (k: string): string[] => k.split(':');
    const prev = previousKey ? split(previousKey) : ['', 'none', 'none'];
    const curr = split(coverageKey);
    const patientChanged = prev[0] !== curr[0];
    const primaryAdded = !patientChanged && prev[1] === 'none' && curr[1] !== 'none';
    const secondaryAdded = !patientChanged && prev[2] === 'none' && curr[2] !== 'none';

    Object.entries(coveragesFormValues).forEach(([key, value]) => {
      const isSecondaryKey = key.endsWith('-2');
      const isAdd = (isSecondaryKey && secondaryAdded) || (!isSecondaryKey && primaryAdded);
      if (isAdd && !isEmptyValue(methods.getValues(key)) && isEmptyValue(value)) {
        // Keep the value the user just saved; mapping returned nothing for it.
        return;
      }
      methods.resetField(key, { defaultValue: value });
    });
  }, [coveragesFormValues, methods, patientId, primaryCoverageId, secondaryCoverageId]);
};
