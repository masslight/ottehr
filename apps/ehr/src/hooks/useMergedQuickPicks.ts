import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getAllergyQuickPicks,
  getMedicalConditionQuickPicks,
  getMedicationQuickPicks,
  getProcedureQuickPicks,
} from 'src/api/api';
import {
  AllergyQuickPickData,
  MEDICAL_HISTORY_CONFIG,
  MedicalConditionQuickPickData,
  MedicationQuickPickData,
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

export function useMergedMedicationQuickPicks(): {
  quickPicks: MedicationQuickPickData[];
  loading: boolean;
} {
  const hardcoded: MedicationQuickPickData[] = useMemo(
    () =>
      (MEDICAL_HISTORY_CONFIG.medications?.quickPicks ?? []).map((qp) => ({
        name: qp.name,
        strength: 'strength' in qp ? (qp.strength as string) : undefined,
        medicationId: 'id' in qp ? (qp.id as number) : undefined,
      })),
    []
  );
  return useMergedQuickPicksGeneric(hardcoded, getMedicationQuickPicks);
}
