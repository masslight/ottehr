import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import { getProviderJournal } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import { GetProviderJournalResponse } from 'utils/lib/types/api/provider-journal.types';

/** One fetch per page load / journal change; callers refetch after an action that moves a row. */
export const useProviderJournal = (
  practitionerId: string | undefined
): UseQueryResult<GetProviderJournalResponse, Error> => {
  const { oystehrZambda } = useApiClients();
  return useQuery({
    queryKey: ['provider-journal', practitionerId],
    queryFn: () =>
      getProviderJournal(oystehrZambda!, { practitionerId: practitionerId!, timezone: DateTime.now().zoneName }),
    enabled: !!oystehrZambda && !!practitionerId,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
    retry: 1,
  });
};
