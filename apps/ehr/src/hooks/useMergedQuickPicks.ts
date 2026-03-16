import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getAllergyQuickPicks,
  getMedicalConditionQuickPicks,
  getMedicationHistoryQuickPicks,
  getProcedureQuickPicks,
} from 'src/api/api';
import {
  AllergyQuickPickData,
  MEDICAL_HISTORY_CONFIG,
  MedicalConditionQuickPickData,
  MedicationHistoryQuickPickData,
  ProcedureQuickPickData,
  PROCEDURES_CONFIG,
} from 'utils';
import { useApiClients } from './useAppClients';

/**
 * Generic hook that fetches FHIR-based quick picks and merges with hardcoded defaults.
 * Falls back gracefully if the zambda is not deployed.
 */
function useMergedQuickPicksGeneric<T>(
  hardcoded: T[],
  fetchFn: (oystehr: any) => Promise<{ quickPicks: T[] }>
): { quickPicks: T[]; loading: boolean } {
  const { oystehrZambda } = useApiClients();
  const [fhirItems, setFhirItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  const doFetch = useCallback(async () => {
    if (!oystehrZambda) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await fetchFn(oystehrZambda);
      setFhirItems(response.quickPicks);
    } catch (error) {
      console.log('FHIR quick picks not available, using hardcoded only:', error);
    } finally {
      setLoading(false);
    }
  }, [oystehrZambda, fetchFn]);

  useEffect(() => {
    void doFetch();
  }, [doFetch]);

  const quickPicks = useMemo(() => [...hardcoded, ...fhirItems], [hardcoded, fhirItems]);

  return { quickPicks, loading };
}

export function useMergedProcedureQuickPicks(): {
  quickPicks: ProcedureQuickPickData[];
  loading: boolean;
} {
  const hardcoded: ProcedureQuickPickData[] = useMemo(() => PROCEDURES_CONFIG.quickPicks ?? [], []);
  return useMergedQuickPicksGeneric(hardcoded, getProcedureQuickPicks);
}

export function useMergedAllergyQuickPicks(): {
  quickPicks: AllergyQuickPickData[];
  loading: boolean;
} {
  const hardcoded: AllergyQuickPickData[] = useMemo(
    () =>
      (MEDICAL_HISTORY_CONFIG.allergies?.quickPicks ?? []).map((qp) => ({
        name: qp.name,
        allergyId: 'id' in qp ? (qp.id as number) : undefined,
      })),
    []
  );
  return useMergedQuickPicksGeneric(hardcoded, getAllergyQuickPicks);
}

export function useMergedMedicalConditionQuickPicks(): {
  quickPicks: MedicalConditionQuickPickData[];
  loading: boolean;
} {
  const hardcoded: MedicalConditionQuickPickData[] = useMemo(
    () =>
      (MEDICAL_HISTORY_CONFIG.medicalConditions?.quickPicks ?? []).map((qp) => ({
        display: qp.display,
        code: 'code' in qp ? (qp.code as string) : undefined,
      })),
    []
  );
  return useMergedQuickPicksGeneric(hardcoded, getMedicalConditionQuickPicks);
}

export function useMergedMedicationHistoryQuickPicks(): {
  quickPicks: MedicationHistoryQuickPickData[];
  loading: boolean;
} {
  const hardcoded: MedicationHistoryQuickPickData[] = useMemo(
    () =>
      (MEDICAL_HISTORY_CONFIG.medications?.quickPicks ?? []).map((qp) => ({
        name: qp.name,
        strength: 'strength' in qp ? (qp.strength as string) : undefined,
        medicationId: 'id' in qp ? (qp.id as number) : undefined,
      })),
    []
  );
  return useMergedQuickPicksGeneric(hardcoded, getMedicationHistoryQuickPicks);
}
