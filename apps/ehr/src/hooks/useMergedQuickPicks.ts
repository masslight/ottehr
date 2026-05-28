import { enqueueSnackbar } from 'notistack';
import { useCallback, useEffect, useState } from 'react';
import {
  getAllergyQuickPicks,
  getImmunizationQuickPicks,
  getInHouseMedicationQuickPicks,
  getInsuranceQuickPicks,
  getMedicalConditionQuickPicks,
  getMedicationHistoryQuickPicks,
  getProcedureQuickPicks,
  getRadiologyQuickPicks,
} from 'src/api/api';
import {
  AllergyQuickPickData,
  ImmunizationQuickPickData,
  InHouseMedicationQuickPickData,
  InsuranceQuickPickData,
  MedicalConditionQuickPickData,
  MedicationHistoryQuickPickData,
  ProcedureQuickPickData,
  RadiologyQuickPickData,
} from 'utils';
import { useApiClients } from './useAppClients';

interface UseFhirQuickPicksResult<T> {
  quickPicks: T[];
  loading: boolean;
  refetch: () => Promise<void>;
}

export const sortQuickPicks = (a: any, b: any): number => {
  const aLabel = a.name ?? a.display ?? '';
  const bLabel = b.name ?? b.display ?? '';
  return aLabel.localeCompare(bLabel);
};

/**
 * Generic hook that fetches FHIR-based quick picks from a zambda endpoint.
 */
export function useFhirQuickPicks<T>(
  fetchFn: (oystehr: any) => Promise<{ quickPicks: T[] }>,
  options?: { enabled?: boolean }
): UseFhirQuickPicksResult<T> {
  const { oystehrZambda } = useApiClients();
  const [quickPicks, setQuickPicks] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const enabled = options?.enabled ?? true;

  const doFetch = useCallback(async () => {
    if (!enabled || !oystehrZambda?.config.accessToken) {
      setQuickPicks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await fetchFn(oystehrZambda);
      setQuickPicks([...response.quickPicks].sort(sortQuickPicks));
    } catch (error) {
      console.error('Failed to load quick picks:', error);
      enqueueSnackbar('Failed to load quick picks', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enabled, oystehrZambda, fetchFn]);

  useEffect(() => {
    void doFetch();
  }, [doFetch]);

  return { quickPicks, loading, refetch: doFetch };
}

export function useMergedProcedureQuickPicks(options?: {
  enabled?: boolean;
}): UseFhirQuickPicksResult<ProcedureQuickPickData> {
  return useFhirQuickPicks(getProcedureQuickPicks, options);
}

export function useMergedAllergyQuickPicks(options?: {
  enabled?: boolean;
}): UseFhirQuickPicksResult<AllergyQuickPickData> {
  return useFhirQuickPicks(getAllergyQuickPicks, options);
}

export function useMergedMedicalConditionQuickPicks(options?: {
  enabled?: boolean;
}): UseFhirQuickPicksResult<MedicalConditionQuickPickData> {
  return useFhirQuickPicks(getMedicalConditionQuickPicks, options);
}

export function useMergedMedicationHistoryQuickPicks(options?: {
  enabled?: boolean;
}): UseFhirQuickPicksResult<MedicationHistoryQuickPickData> {
  return useFhirQuickPicks(getMedicationHistoryQuickPicks, options);
}

export function useMergedRadiologyQuickPicks(options?: {
  enabled?: boolean;
}): UseFhirQuickPicksResult<RadiologyQuickPickData> {
  return useFhirQuickPicks(getRadiologyQuickPicks, options);
}

export function useMergedImmunizationQuickPicks(options?: {
  enabled?: boolean;
}): UseFhirQuickPicksResult<ImmunizationQuickPickData> {
  return useFhirQuickPicks(getImmunizationQuickPicks, options);
}

export function useMergedInHouseMedicationQuickPicks(options?: {
  enabled?: boolean;
}): UseFhirQuickPicksResult<InHouseMedicationQuickPickData> {
  return useFhirQuickPicks(getInHouseMedicationQuickPicks, options);
}

export function useMergedInsuranceQuickPicks(options?: {
  enabled?: boolean;
}): UseFhirQuickPicksResult<InsuranceQuickPickData> {
  return useFhirQuickPicks(getInsuranceQuickPicks, options);
}
