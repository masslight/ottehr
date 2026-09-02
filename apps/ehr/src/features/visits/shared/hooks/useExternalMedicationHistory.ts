import { ErxGetMedicationHistoryResponse, ErxSearchMedicationsResponse } from '@oystehr/sdk';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { isErxPermissionDeniedError } from 'src/features/visits/shared/utils/erxErrors';
import { useApiClients } from 'src/hooks/useAppClients';
import { MedicationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { ExtractObjectType } from '../stores/appointment/appointment.queries';
import { useAppointmentData } from '../stores/appointment/appointment.store';

type ExternalHistoryItem = ErxGetMedicationHistoryResponse[number];

export interface ExternalMedication {
  /** Raw external history item */
  name: string;
  strength: string | null;
  doseForm: string | null;
  route: string | null;
  directions: string | null;
  writtenDate: string | null;
  lastFillDate: string | null;
  refills: string;
  quantity: number;
  /** If recognized via search, the matched eRx medication object for form pre-population */
  matchedMedication: ExtractObjectType<ErxSearchMedicationsResponse> | null;
  /** Whether the match is exact (true) or a closest/fuzzy match (false) */
  isExactMatch: boolean;
}

export interface UseExternalMedicationHistoryResult {
  isLoading: boolean;
  isAvailable: boolean;
  externalMedications: ExternalMedication[];
  error: Error | null;
  /** True when the history is unavailable because the signed-in user's role cannot read eRx data. */
  isPermissionDenied: boolean;
}

/**
 * The three outcomes a caller must be able to tell apart. Kept together here, next to the query that
 * produces the state, the same way appointment.queries.ts exports MEDICATION_DATABASE_FORBIDDEN_MESSAGE.
 *
 * The distinction is the point: reporting a failed or forbidden request as "no medications found" tells
 * the user something false about their patient.
 */
export const EXTERNAL_HISTORY_FORBIDDEN_MESSAGE =
  'Not available — your role does not have access to external medication history.';
export const EXTERNAL_HISTORY_FAILED_MESSAGE = "Not available — couldn't load external medication history.";
export const EXTERNAL_HISTORY_EMPTY_MESSAGE = 'No external medications found, or all have been reconciled.';

// Mock data for development/testing — remove when real eRx data is available
const MOCK_EXTERNAL_HISTORY: ExternalHistoryItem[] = [
  {
    id: 50001,
    medicationId: 15237,
    ndc: null,
    rxcui: 2047715,
    name: 'amLODIPine Besylate-Celecoxib',
    route: 'Oral',
    doseForm: 'Tablet',
    strength: '2.5-200 MG',
    dispenseUnit: 'Tablet',
    isBrandName: false,
    genericName: 'amlodipine besylate-celecoxib',
    isOtc: false,
    refills: '3',
    daysSupply: 30,
    quantity: 30,
    classification: 'Calcium Channel Blocker',
    schedule: null,
    directions: 'Take one tablet by mouth daily.',
    substitutionsAllowed: true,
    writtenDate: '2025-09-12',
    effectiveDate: '2025-09-12',
    lastFillDate: '2025-10-12',
    expirationDate: '2026-09-12',
  },
  {
    id: 50002,
    medicationId: 15238,
    ndc: null,
    rxcui: 2047716,
    name: 'amLODIPine Besylate-Celecoxib',
    route: 'Oral',
    doseForm: 'Tablet',
    strength: '5-200 MG',
    dispenseUnit: 'Tablet',
    isBrandName: false,
    genericName: 'amlodipine besylate-celecoxib',
    isOtc: false,
    refills: '2',
    daysSupply: 30,
    quantity: 30,
    classification: 'Calcium Channel Blocker',
    schedule: null,
    directions: 'Take one tablet by mouth daily.',
    substitutionsAllowed: true,
    writtenDate: '2025-08-15',
    effectiveDate: '2025-08-15',
    lastFillDate: '2025-11-10',
    expirationDate: '2026-08-15',
  },
  {
    id: 50003,
    medicationId: 6693,
    ndc: '72865024590',
    rxcui: 966249,
    name: 'Levothyroxine Sodium',
    route: 'Oral',
    doseForm: 'Tablet',
    strength: '175 MCG',
    dispenseUnit: 'Tablet',
    isBrandName: false,
    genericName: 'levothyroxine sodium',
    isOtc: false,
    refills: '4',
    daysSupply: 30,
    quantity: 30,
    classification: 'Thyroid Agent',
    schedule: null,
    directions: 'Take one tablet (175 mcg) by mouth daily on an empty stomach.',
    substitutionsAllowed: true,
    writtenDate: '2025-05-10',
    effectiveDate: '2025-05-10',
    lastFillDate: '2026-02-02',
    expirationDate: '2026-05-10',
  },
  {
    id: 50004,
    medicationId: 6692,
    ndc: '62991170903',
    rxcui: null,
    name: 'Levothyroxine Sodium',
    route: null,
    doseForm: 'Powder',
    strength: null,
    dispenseUnit: 'Gram',
    isBrandName: false,
    genericName: 'levothyroxine sodium',
    isOtc: false,
    refills: '1',
    daysSupply: 30,
    quantity: 30,
    classification: 'Thyroid Agent',
    schedule: null,
    directions: 'Use as directed.',
    substitutionsAllowed: true,
    writtenDate: '2025-06-18',
    effectiveDate: '2025-06-18',
    lastFillDate: '2025-12-20',
    expirationDate: '2026-06-18',
  },
  {
    id: 50005,
    medicationId: 22329,
    ndc: '81964020415',
    rxcui: 617322,
    name: 'Amoxicillin-Pot Clavulanate',
    route: 'Oral',
    doseForm: 'Suspension Reconstituted',
    strength: '250-62.5 MG/5ML',
    dispenseUnit: 'Milliliter',
    isBrandName: false,
    genericName: 'amoxicillin-potassium clavulanate',
    isOtc: false,
    refills: '0',
    daysSupply: 10,
    quantity: 150,
    classification: 'Penicillin',
    schedule: null,
    directions: 'Take 5 mL by mouth every 8 hours for 10 days.',
    substitutionsAllowed: true,
    writtenDate: '2025-10-05',
    effectiveDate: '2025-10-05',
    lastFillDate: '2025-10-05',
    expirationDate: '2026-10-05',
  },
  {
    id: 50006,
    medicationId: 22328,
    ndc: null,
    rxcui: 1291986,
    name: 'Amoxicill-Clarithro-Omeprazole',
    route: 'Oral',
    doseForm: 'Miscellaneous',
    strength: '500-500-20 MG',
    dispenseUnit: 'Kit',
    isBrandName: false,
    genericName: 'amoxicillin-clarithromycin-omeprazole',
    isOtc: false,
    refills: '0',
    daysSupply: 14,
    quantity: 1,
    classification: 'Antibiotic Combination',
    schedule: null,
    directions: 'Take as directed for 14 days.',
    substitutionsAllowed: true,
    writtenDate: '2025-11-12',
    effectiveDate: '2025-11-12',
    lastFillDate: '2025-11-12',
    expirationDate: '2026-11-12',
  },
  {
    id: 50007,
    medicationId: 15239,
    ndc: null,
    rxcui: 2047717,
    name: 'amLODIPine Besylate-Celecoxib',
    route: 'Oral',
    doseForm: 'Tablet',
    strength: '10-200 MG',
    dispenseUnit: 'Tablet',
    isBrandName: false,
    genericName: 'amlodipine besylate-celecoxib',
    isOtc: false,
    refills: '5',
    daysSupply: 30,
    quantity: 30,
    classification: 'Calcium Channel Blocker',
    schedule: null,
    directions: 'Take one tablet by mouth daily.',
    substitutionsAllowed: true,
    writtenDate: '2025-07-20',
    effectiveDate: '2025-07-20',
    lastFillDate: '2026-01-15',
    expirationDate: '2026-07-20',
  },
];

const IS_SANDBOX = ['local', 'development'].includes(import.meta.env.VITE_APP_ENV ?? '');

export const useExternalMedicationHistory = (
  chartedMedications: MedicationDTO[]
): UseExternalMedicationHistoryResult => {
  const { oystehr } = useApiClients();
  const {
    resources: { patient },
  } = useAppointmentData();
  const patientId = patient?.id;

  // Step 1: Fetch external medication history (or use mock in dev)
  const {
    data: rawHistory,
    isLoading: isHistoryLoading,
    error: historyError,
  } = useQuery({
    queryKey: ['external-medication-history', patientId],
    queryFn: async () => {
      if (!oystehr || !patientId) throw new Error('API client or patient not available');
      try {
        const history = await oystehr.erx.getMedicationHistory({ patientId });
        if (history.length > 0) return history;
        // The request succeeded and the patient genuinely has nothing on file. A *successful* call is
        // the only path allowed to resolve rather than throw — which means empty in real environments,
        // and the stub rows in sandbox so local dev has a populated panel to build against. Note that
        // therefore the real empty state is not reachable in sandbox; see the catch below.
        return IS_SANDBOX ? MOCK_EXTERNAL_HISTORY : [];
      } catch (error) {
        // Fail closed. The eRx SDK error does not reliably carry the HTTP status (see
        // utils/erxErrors.ts), so we cannot tell a permission denial from a transient failure here —
        // and resolving to [] would render "No external medications found" for both, making a broken
        // backend indistinguishable from a patient with no medications. Let it reject so the caller
        // reports the list as unavailable; isErxPermissionDeniedError then only picks the wording.
        if (IS_SANDBOX && !isErxPermissionDeniedError(error)) return MOCK_EXTERNAL_HISTORY;
        throw error;
      }
    },
    enabled: !!oystehr && !!patientId,
    staleTime: 5 * 60 * 1000,
    retry: (failureCount, error) => !isErxPermissionDeniedError(error) && failureCount < 1,
    // Poll every 10s while the eRx service is still populating history — that is, only while the call
    // is succeeding and returning nothing yet. Any error stops polling: a denial can never succeed on
    // retry, and for other failures an undetected denial must not spin forever.
    refetchInterval: (query) => {
      if (query.state.error) return false;
      const data = query.state.data;
      if (!data || data.length === 0) return 10_000;
      return false;
    },
  });

  // Step 2: Look up each unique medicationId to get the full medication object
  const uniqueMedicationIds = useMemo(() => {
    if (!rawHistory) return [];
    const seen = new Set<number>();
    return rawHistory
      .map((item) => item.medicationId)
      .filter((id) => {
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
      });
  }, [rawHistory]);

  const lookupKey = useMemo(() => uniqueMedicationIds.join(','), [uniqueMedicationIds]);

  const { data: medicationLookup, isLoading: isLookupLoading } = useQuery({
    queryKey: ['external-medication-lookup', lookupKey],
    queryFn: async () => {
      if (!oystehr) throw new Error('API client not available');
      const results = new Map<number, ExtractObjectType<ErxSearchMedicationsResponse>>();
      await Promise.all(
        uniqueMedicationIds.map(async (medicationId) => {
          try {
            const med = await oystehr.erx.getMedication({ drugId: medicationId });
            if (med) {
              results.set(medicationId, {
                id: med.id,
                routedDoseFormDrugId: med.id,
                name: med.name,
                rxcui: med.rxcui ?? null,
                ndc: med.ndc ?? null,
                strength: med.strength ?? '',
                isObsolete: med.isObsolete,
              });
            }
          } catch {
            /* lookup failed for this medicationId */
          }
        })
      );
      return results;
    },
    enabled: !!oystehr && uniqueMedicationIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  // Step 3: Filter out medications already on the chart and build final list
  const externalMedications = useMemo(() => {
    if (!rawHistory || !medicationLookup) return [];

    // Build set of charted medication IDs for exact matching
    const chartedIds = new Set(chartedMedications.map((med) => med.id).filter(Boolean));

    return rawHistory
      .filter((item) => {
        const matched = item.medicationId ? medicationLookup.get(item.medicationId) : null;
        return !(matched?.id && chartedIds.has(String(matched.id)));
      })
      .map(
        (item): ExternalMedication => ({
          name: item.name,
          strength: item.strength,
          doseForm: item.doseForm,
          route: item.route,
          directions: item.directions,
          writtenDate: item.writtenDate,
          lastFillDate: item.lastFillDate,
          refills: item.refills,
          quantity: item.quantity,
          matchedMedication: (item.medicationId ? medicationLookup.get(item.medicationId) : null) ?? null,
          isExactMatch: item.medicationId ? medicationLookup.has(item.medicationId) : false,
        })
      );
  }, [rawHistory, medicationLookup, chartedMedications]);

  const isLoading = isHistoryLoading || (!!rawHistory && rawHistory.length > 0 && isLookupLoading);

  return {
    isLoading,
    isAvailable: !historyError,
    externalMedications,
    error: historyError ?? null,
    isPermissionDenied: isErxPermissionDeniedError(historyError),
  };
};
