import { ErxGetMedicationHistoryResponse, ErxSearchMedicationsResponse } from '@oystehr/sdk';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useApiClients } from 'src/hooks/useAppClients';
import { MedicationDTO } from 'utils';
import { ExtractObjectType } from '../stores/appointment/appointment.queries';
import { useAppointmentData } from '../stores/appointment/appointment.store';

type ExternalHistoryItem = ErxGetMedicationHistoryResponse[number];
type SearchResult = ExtractObjectType<ErxSearchMedicationsResponse>;

/**
 * Normalize a strength string for comparison by stripping whitespace and lowercasing.
 * e.g. "500 mg" → "500mg", "20 MG" → "20mg"
 */
function normalizeStrength(strength: string | null | undefined): string {
  if (!strength) return '';
  return strength.toLowerCase().replace(/\s+/g, '');
}

/**
 * Score a search result against the external medication's name and strength.
 * Higher score = better match.
 *   +2 = exact name match
 *   +1 = name is a substring match (external name appears in search result name or vice versa)
 *   +2 = exact strength match
 *   +1 = strength appears somewhere in the search result's strength or name
 */
function scoreMatch(candidate: SearchResult, externalName: string, externalStrength: string | null): number {
  let score = 0;
  const candidateNameLower = candidate.name.toLowerCase();
  const externalNameLower = externalName.toLowerCase();

  // Name scoring
  if (candidateNameLower === externalNameLower) {
    score += 2;
  } else if (candidateNameLower.includes(externalNameLower) || externalNameLower.includes(candidateNameLower)) {
    score += 1;
  }

  // Strength scoring
  const normExtStrength = normalizeStrength(externalStrength);
  if (normExtStrength) {
    const normCandStrength = normalizeStrength(candidate.strength);
    if (normCandStrength === normExtStrength) {
      score += 2;
    } else if (normCandStrength.includes(normExtStrength) || normExtStrength.includes(normCandStrength)) {
      score += 1;
    }
  }

  return score;
}

/**
 * Find the best matching medication from search results.
 * Priority order:
 *   1. rxcui match — strongest exact match if the external med has an rxcui
 *   2. Name + strength scoring — falls back to fuzzy matching
 */
function findBestMatch(
  searchResponse: ErxSearchMedicationsResponse,
  externalName: string,
  externalStrength: string | null,
  externalRxcui: number | null
): { match: SearchResult | null; isExact: boolean } {
  if (searchResponse.length === 0) return { match: null, isExact: false };

  // Step 1: Try rxcui match first — this is the strongest identifier match
  if (externalRxcui != null) {
    const rxcuiMatch = searchResponse.find((med) => med.rxcui === externalRxcui);
    if (rxcuiMatch) {
      return { match: rxcuiMatch, isExact: true };
    }
  }

  // Step 2: Fall back to name + strength scoring
  let bestCandidate: SearchResult | null = null;
  let bestScore = -1;

  for (const candidate of searchResponse) {
    const score = scoreMatch(candidate, externalName, externalStrength);
    if (score > bestScore) {
      bestScore = score;
      bestCandidate = candidate;
    }
  }

  // Exact match = name exact (2) + strength exact (2) = 4, or name exact (2) with no strength to match
  const isExact = externalStrength
    ? bestScore >= 4
    : bestScore >= 2 && bestCandidate?.name.toLowerCase() === externalName.toLowerCase();

  return { match: bestCandidate, isExact };
}

export interface ExternalMedication {
  /** Raw external history item */
  name: string;
  strength: string | null;
  doseForm: string | null;
  route: string | null;
  directions: string | null;
  writtenDate: string;
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
}

// Mock data for development/testing — remove when real eRx data is available
const MOCK_EXTERNAL_HISTORY: ExternalHistoryItem[] = [
  {
    id: 1001,
    medicationId: 50001,
    ndc: '00093-5057-01',
    rxcui: 329528,
    name: 'amLODIPine',
    route: 'Oral',
    doseForm: 'Tablet',
    strength: '2.5 mg',
    dispenseUnit: 'Tablet',
    isBrandName: false,
    genericName: 'amlodipine besylate',
    isOtc: false,
    refills: '3',
    daysSupply: 30,
    quantity: 30,
    classification: 'Calcium Channel Blocker',
    schedule: null,
    directions: 'Take one tablet (2.5 mg) by mouth daily.',
    substitutionsAllowed: true,
    writtenDate: '2025-09-12',
    effectiveDate: '2025-09-12',
    lastFillDate: '2025-10-12',
    expirationDate: '2026-09-12',
  },
  {
    id: 1002,
    medicationId: 50002,
    ndc: '00093-7341-01',
    rxcui: 314076,
    name: 'LisinoPRIL',
    route: 'Oral',
    doseForm: 'Tablet',
    strength: '10 mg',
    dispenseUnit: 'Tablet',
    isBrandName: false,
    genericName: 'lisinopril',
    isOtc: false,
    refills: '2',
    daysSupply: 30,
    quantity: 30,
    classification: 'ACE Inhibitor',
    schedule: null,
    directions: 'Take one tablet (10 mg) by mouth daily.',
    substitutionsAllowed: true,
    writtenDate: '2025-08-15',
    effectiveDate: '2025-08-15',
    lastFillDate: '2025-11-10',
    expirationDate: '2026-08-15',
  },
  {
    id: 1003,
    medicationId: 50003,
    ndc: '00093-5058-01',
    rxcui: 259255,
    name: 'AtorvaSTATin',
    route: 'Oral',
    doseForm: 'Tablet',
    strength: '20 mg',
    dispenseUnit: 'Tablet',
    isBrandName: false,
    genericName: 'atorvastatin calcium',
    isOtc: false,
    refills: '5',
    daysSupply: 30,
    quantity: 30,
    classification: 'HMG-CoA Reductase Inhibitor',
    schedule: null,
    directions: 'Take one tablet (20 mg) by mouth every evening.',
    substitutionsAllowed: true,
    writtenDate: '2025-07-20',
    effectiveDate: '2025-07-20',
    lastFillDate: '2026-01-15',
    expirationDate: '2026-07-20',
  },
  {
    id: 1004,
    medicationId: 50004,
    ndc: '00378-1805-01',
    rxcui: 966247,
    name: 'Levothyroxine',
    route: 'Oral',
    doseForm: 'Tablet',
    strength: '50 mcg',
    dispenseUnit: 'Tablet',
    isBrandName: false,
    genericName: 'levothyroxine sodium',
    isOtc: false,
    refills: '4',
    daysSupply: 30,
    quantity: 30,
    classification: 'Thyroid Agent',
    schedule: null,
    directions: 'Take one tablet (50 mcg) by mouth daily on an empty stomach.',
    substitutionsAllowed: true,
    writtenDate: '2025-05-10',
    effectiveDate: '2025-05-10',
    lastFillDate: '2026-02-02',
    expirationDate: '2026-05-10',
  },
  {
    id: 1005,
    medicationId: 50005,
    ndc: '00093-7212-01',
    rxcui: 861007,
    name: 'MetFORMIN',
    route: 'Oral',
    doseForm: 'Tablet',
    strength: '500 mg',
    dispenseUnit: 'Tablet',
    isBrandName: false,
    genericName: 'metformin hydrochloride',
    isOtc: false,
    refills: '1',
    daysSupply: 30,
    quantity: 60,
    classification: 'Biguanide',
    schedule: null,
    directions: 'Take one tablet (500 mg) by mouth twice daily with meals.',
    substitutionsAllowed: true,
    writtenDate: '2025-06-18',
    effectiveDate: '2025-06-18',
    lastFillDate: '2025-12-20',
    expirationDate: '2026-06-18',
  },
  {
    id: 1006,
    medicationId: 50006,
    ndc: '00093-5116-01',
    rxcui: 198365,
    name: 'Alendronate',
    route: 'Oral',
    doseForm: 'Tablet',
    strength: '70 mg',
    dispenseUnit: 'Tablet',
    isBrandName: false,
    genericName: 'alendronate sodium',
    isOtc: false,
    refills: '3',
    daysSupply: 28,
    quantity: 4,
    classification: 'Bisphosphonate',
    schedule: null,
    directions: 'Take one tablet (70 mg) by mouth once weekly.',
    substitutionsAllowed: true,
    writtenDate: '2025-09-30',
    effectiveDate: '2025-09-30',
    lastFillDate: '2025-12-28',
    expirationDate: '2026-09-30',
  },
  {
    id: 1007,
    medicationId: 50007,
    ndc: '00093-5340-01',
    rxcui: 198106,
    name: 'Omeprazole',
    route: 'Oral',
    doseForm: 'Capsule',
    strength: '20 mg',
    dispenseUnit: 'Capsule',
    isBrandName: false,
    genericName: 'omeprazole',
    isOtc: false,
    refills: '2',
    daysSupply: 30,
    quantity: 30,
    classification: 'Proton Pump Inhibitor',
    schedule: null,
    directions: 'Take one capsule (20 mg) by mouth daily before breakfast.',
    substitutionsAllowed: true,
    writtenDate: '2025-10-05',
    effectiveDate: '2025-10-05',
    lastFillDate: '2026-01-10',
    expirationDate: '2026-10-05',
  },
  {
    id: 1008,
    medicationId: 50008,
    ndc: '00363-0227-01',
    rxcui: 198440,
    name: 'Acetaminophen',
    route: 'Oral',
    doseForm: 'Tablet',
    strength: '500 mg',
    dispenseUnit: 'Tablet',
    isBrandName: false,
    genericName: 'acetaminophen',
    isOtc: true,
    refills: '0',
    daysSupply: 30,
    quantity: 120,
    classification: 'Analgesic',
    schedule: null,
    directions: 'Take one tablet (500 mg) by mouth every 6 hours as needed for pain.',
    substitutionsAllowed: true,
    writtenDate: '2025-11-12',
    effectiveDate: '2025-11-12',
    lastFillDate: '2026-01-05',
    expirationDate: '2026-11-12',
  },
];

const USE_MOCK_DATA = import.meta.env.DEV;

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
      if (USE_MOCK_DATA) {
        // Simulate network delay for realistic UX
        await new Promise((resolve) => setTimeout(resolve, 500));
        return MOCK_EXTERNAL_HISTORY;
      }
      return oystehr.erx.getMedicationHistory({ patientId });
    },
    enabled: !!oystehr && !!patientId,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  // Step 2: Search each unique medication name to check if recognized
  // Track unique entries by name+strength for matching
  const uniqueEntries = useMemo(() => {
    if (!rawHistory) return [];
    const seen = new Set<string>();
    return rawHistory.filter((item) => {
      const key = `${item.name}|${item.strength ?? ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [rawHistory]);

  const searchKey = useMemo(() => uniqueEntries.map((e) => `${e.name}|${e.strength ?? ''}`).join(','), [uniqueEntries]);

  const { data: searchResults, isLoading: isSearchLoading } = useQuery({
    queryKey: ['external-medication-search', searchKey],
    queryFn: async () => {
      if (!oystehr) throw new Error('API client not available');
      const results = new Map<
        string,
        { match: ExtractObjectType<ErxSearchMedicationsResponse> | null; isExact: boolean }
      >();
      await Promise.all(
        uniqueEntries.map(async (entry) => {
          const key = `${entry.name}|${entry.strength ?? ''}`;
          try {
            const searchResponse = await oystehr.erx.searchMedications({ name: entry.name });
            const match = findBestMatch(searchResponse, entry.name, entry.strength, entry.rxcui);
            results.set(key, match);
          } catch {
            results.set(key, { match: null, isExact: false });
          }
        })
      );
      return results;
    },
    enabled: !!oystehr && uniqueEntries.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  // Step 3: Filter out medications already on the chart and build final list
  const externalMedications = useMemo(() => {
    if (!rawHistory || !searchResults) return [];

    // Charted medication names can be verbose, e.g. "Omeprazole Magnesium Oral Capsule Delayed Release (20.6 (20 Base) MG)"
    // while external names may be short, e.g. "Omeprazole". Use substring matching in both directions.
    const chartedNamesLower = chartedMedications.map((med) => med.name.toLowerCase().trim());

    return rawHistory
      .filter((item) => {
        const externalName = item.name.toLowerCase().trim();
        // Check if any charted medication name contains the external name or vice versa
        const alreadyCharted = chartedNamesLower.some(
          (charted) => charted.includes(externalName) || externalName.includes(charted)
        );
        return !alreadyCharted;
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
          matchedMedication: searchResults.get(`${item.name}|${item.strength ?? ''}`)?.match ?? null,
          isExactMatch: searchResults.get(`${item.name}|${item.strength ?? ''}`)?.isExact ?? false,
        })
      );
  }, [rawHistory, searchResults, chartedMedications]);

  const isLoading = isHistoryLoading || (!!rawHistory && rawHistory.length > 0 && isSearchLoading);

  return {
    isLoading,
    isAvailable: !historyError,
    externalMedications,
    error: historyError ?? null,
  };
};
