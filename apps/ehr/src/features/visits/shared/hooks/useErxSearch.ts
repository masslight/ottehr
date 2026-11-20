import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { searchMedications } from 'src/api/api';
import { useAuthToken } from 'src/hooks/useAuthToken';
import { MedicationSearchDrug } from 'utils/lib/types/api/erx-search.types';

const MIN_QUERY_LENGTH = 2;

export const useSearchMedications = (query: string): UseQueryResult<MedicationSearchDrug[], Error> => {
  const token = useAuthToken();

  return useQuery({
    queryKey: ['erx-search-medications', query],
    queryFn: () => searchMedications(token!, query),
    enabled: Boolean(token) && query.trim().length >= MIN_QUERY_LENGTH,
  });
};
