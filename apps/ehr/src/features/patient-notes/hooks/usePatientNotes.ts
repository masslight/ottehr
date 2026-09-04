import { useInfiniteQuery, UseInfiniteQueryResult } from '@tanstack/react-query';
import { GetPatientNotesOutput } from 'utils/lib/types/api/patient-notes/patient-notes.types';
import { getPatientNotes } from '../../../api/api';
import { useApiClients } from '../../../hooks/useAppClients';

const PAGE_SIZE = 20;

export const usePatientNotes = (
  patientId: string | undefined
): UseInfiniteQueryResult<{ pages: GetPatientNotesOutput[] }, Error> => {
  const { oystehrZambda } = useApiClients();

  return useInfiniteQuery({
    queryKey: ['patient-notes', { patientId }],
    queryFn: async ({ pageParam }) => {
      if (!oystehrZambda || !patientId) throw new Error('Missing client or patientId');
      return getPatientNotes(oystehrZambda, { patientId, offset: pageParam, pageSize: PAGE_SIZE });
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.hasMore) return undefined;
      return allPages.reduce((sum, page) => sum + page.notes.length, 0);
    },
    enabled: Boolean(patientId) && Boolean(oystehrZambda),
  });
};
