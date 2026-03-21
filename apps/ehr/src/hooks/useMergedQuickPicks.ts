import { enqueueSnackbar } from 'notistack';
import { useCallback, useEffect, useState } from 'react';
import {
  getAllergyQuickPicks,
  getImmunizationQuickPicks,
  getMedicalConditionQuickPicks,
  getMedicationHistoryQuickPicks,
  getProcedureQuickPicks,
} from 'src/api/api';
import {
  AllergyQuickPickData,
  ImmunizationQuickPickData,
  MedicalConditionQuickPickData,
  MedicationHistoryQuickPickData,
  ProcedureQuickPickData,
} from 'utils';
import { useApiClients } from './useAppClients';

/**
 * Generic hook that fetches FHIR-based quick picks from a zambda endpoint.
 */
function useFhirQuickPicks<T>(fetchFn: (oystehr: any) => Promise<{ quickPicks: T[] }>): {
  quickPicks: T[];
  loading: boolean;
} {
  const { oystehrZambda } = useApiClients();
  const [quickPicks, setQuickPicks] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  const doFetch = useCallback(async () => {
    if (!oystehrZambda) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await fetchFn(oystehrZambda);
      setQuickPicks(response.quickPicks);
    } catch (error) {
      console.error('Failed to load quick picks:', error);
      enqueueSnackbar('Failed to load quick picks', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [oystehrZambda, fetchFn]);

  useEffect(() => {
    void doFetch();
  }, [doFetch]);

  return { quickPicks, loading };
}

export function useMergedProcedureQuickPicks(): {
  quickPicks: ProcedureQuickPickData[];
  loading: boolean;
} {
  return useFhirQuickPicks(getProcedureQuickPicks);
}

export function useMergedAllergyQuickPicks(): {
  quickPicks: AllergyQuickPickData[];
  loading: boolean;
} {
  return useFhirQuickPicks(getAllergyQuickPicks);
}

export function useMergedMedicalConditionQuickPicks(): {
  quickPicks: MedicalConditionQuickPickData[];
  loading: boolean;
} {
  return useFhirQuickPicks(getMedicalConditionQuickPicks);
}

export function useMergedMedicationHistoryQuickPicks(): {
  quickPicks: MedicationHistoryQuickPickData[];
  loading: boolean;
} {
  return useFhirQuickPicks(getMedicationHistoryQuickPicks);
}

export function useMergedImmunizationQuickPicks(): {
  quickPicks: ImmunizationQuickPickData[];
  loading: boolean;
} {
  return useFhirQuickPicks(getImmunizationQuickPicks);
}
