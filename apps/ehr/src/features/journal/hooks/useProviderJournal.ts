import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { getProviderJournal } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import { GetProviderJournalResponse } from 'utils/lib/types/api/provider-journal.types';

/**
 * Reloads when the page mounts, when the Journal tab is clicked and when the user comes back to the
 * journal's browser tab (every journal link opens a new tab); no timer. Callers refetch after an
 * action that moves a row.
 */
export const useProviderJournal = (
  practitionerId: string | undefined
): UseQueryResult<GetProviderJournalResponse, Error> => {
  const { oystehrZambda } = useApiClients();
  const query = useQuery({
    queryKey: ['provider-journal', practitionerId],
    queryFn: () =>
      getProviderJournal(oystehrZambda!, { practitionerId: practitionerId!, timezone: DateTime.now().zoneName }),
    enabled: !!oystehrZambda && !!practitionerId,
    refetchOnWindowFocus: 'always',
    refetchOnMount: 'always',
    staleTime: Infinity,
    retry: 1,
  });

  // Clicking the Journal tab while on the journal navigates to the same path with a new location key.
  const { key } = useLocation();
  const lastKey = useRef(key);
  const { refetch } = query;
  useEffect(() => {
    if (lastKey.current === key) return;
    lastKey.current = key;
    void refetch();
  }, [key, refetch]);

  return query;
};
