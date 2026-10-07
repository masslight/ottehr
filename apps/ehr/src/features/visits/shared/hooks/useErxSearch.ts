import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { searchMedications, searchPharmacies } from 'src/api/api';
import { MedicationSearchResult, PharmacySearchResult } from 'utils/lib/types/api/erx-search.types';

const MIN_QUERY_LENGTH = 2;

export const useSearchMedications = (query: string): UseQueryResult<MedicationSearchResult[], Error> =>
  useQuery({
    queryKey: ['erx-search-medications', query],
    queryFn: () => searchMedications(query),
    enabled: query.trim().length >= MIN_QUERY_LENGTH,
  });

export const useSearchPharmacies = (query: string): UseQueryResult<PharmacySearchResult[], Error> =>
  useQuery({
    queryKey: ['erx-search-pharmacies', query],
    queryFn: () => searchPharmacies(query),
    enabled: query.trim().length >= MIN_QUERY_LENGTH,
  });
