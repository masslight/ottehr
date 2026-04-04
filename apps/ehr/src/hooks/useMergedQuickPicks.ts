import { enqueueSnackbar } from 'notistack';
import { useCallback, useEffect, useState } from 'react';
import {
  getAllergyQuickPicks,
  getMedicalConditionQuickPicks,
  getMedicationHistoryQuickPicks,
  getProcedureQuickPicks,
  getRadiologyQuickPicks,
} from 'src/api/api';
import {
  AllergyQuickPickData,
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

/**
 * Generic hook that fetches FHIR-based quick picks from a zambda endpoint.
 */
function useFhirQuickPicks<T>(fetchFn: (oystehr: any) => Promise<{ quickPicks: T[] }>): UseFhirQuickPicksResult<T> {
  const { oystehrZambda } = useApiClients();
  const [quickPicks, setQuickPicks] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  const doFetch = useCallback(
    async (signal?: AbortSignal) => {
      if (!oystehrZambda) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const response = await fetchFn(oystehrZambda);
        if (signal?.aborted) return;
        setQuickPicks(response.quickPicks);
      } catch (error) {
        if (signal?.aborted) return;
        console.error('Failed to load quick picks:', error);
        enqueueSnackbar('Failed to load quick picks', { variant: 'error' });
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [oystehrZambda, fetchFn]
  );

  useEffect(() => {
    const controller = new AbortController();
    void doFetch(controller.signal);
    return () => controller.abort();
  }, [doFetch]);

  return { quickPicks, loading, refetch: doFetch };
}

export function useMergedProcedureQuickPicks(): UseFhirQuickPicksResult<ProcedureQuickPickData> {
  return useFhirQuickPicks(getProcedureQuickPicks);
}

export function useMergedAllergyQuickPicks(): UseFhirQuickPicksResult<AllergyQuickPickData> {
  return useFhirQuickPicks(getAllergyQuickPicks);
}

export function useMergedMedicalConditionQuickPicks(): UseFhirQuickPicksResult<MedicalConditionQuickPickData> {
  return useFhirQuickPicks(getMedicalConditionQuickPicks);
}

export function useMergedMedicationHistoryQuickPicks(): UseFhirQuickPicksResult<MedicationHistoryQuickPickData> {
  return useFhirQuickPicks(getMedicationHistoryQuickPicks);
}

export function useMergedRadiologyQuickPicks(): UseFhirQuickPicksResult<RadiologyQuickPickData> {
  return useFhirQuickPicks(getRadiologyQuickPicks);
}
