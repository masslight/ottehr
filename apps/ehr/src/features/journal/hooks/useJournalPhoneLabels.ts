import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { getJournalPhoneLabels } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import { GetJournalPhoneLabelsResponse } from 'utils/lib/types/api/provider-journal.types';

const LABELS_STALE_MS = 5 * 60 * 1000;

/** Who signed consent for each account phone ("Mei Chen (Parent)"), read when the side column shows the patient. */
export const useJournalPhoneLabels = (
  patientId: string | undefined
): UseQueryResult<GetJournalPhoneLabelsResponse, Error> => {
  const { oystehrZambda } = useApiClients();
  return useQuery({
    queryKey: ['journal-phone-labels', patientId],
    queryFn: () => getJournalPhoneLabels(oystehrZambda!, { patientId: patientId! }),
    enabled: !!oystehrZambda && !!patientId,
    // A label changes only with a new booking's paperwork.
    staleTime: LABELS_STALE_MS,
    retry: 1,
  });
};
