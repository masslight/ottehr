import { InfiniteData, QueryClient, useInfiniteQuery, UseInfiniteQueryResult } from '@tanstack/react-query';
import { GetPatientNotesOutput } from 'utils/lib/types/api/patient-notes/patient-notes.types';
import { getPatientNotes } from '../../../api/api';
import { useApiClients } from '../../../hooks/useAppClients';

const PAGE_SIZE = 20;

/** Whose notes: a patient's, or a task's. */
export interface NoteTarget {
  patientId?: string;
  taskId?: string;
}

export const noteKind = (target: NoteTarget): 'task' | 'patient' => (target.taskId ? 'task' : 'patient');

/** Every notes query (a patient's, a task's, the Tasks board's) and the patient notes count refresh together. */
export const invalidateNotes = (queryClient: QueryClient): void => {
  void queryClient.invalidateQueries({ queryKey: ['patient-notes'] });
  void queryClient.invalidateQueries({ queryKey: ['patient-notes-count'] });
};

export const usePatientNotes = (
  target: NoteTarget
): UseInfiniteQueryResult<InfiniteData<GetPatientNotesOutput>, Error> => {
  const { oystehrZambda } = useApiClients();
  const { patientId, taskId } = target;

  return useInfiniteQuery({
    queryKey: ['patient-notes', target],
    queryFn: async ({ pageParam }) => {
      if (!oystehrZambda || !(patientId || taskId)) throw new Error('Missing client or note target');
      // A task's notes come back in one page.
      if (taskId) return getPatientNotes(oystehrZambda, { taskIds: [taskId] });
      return getPatientNotes(oystehrZambda, { patientId, offset: pageParam, pageSize: PAGE_SIZE });
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.hasMore) return undefined;
      return allPages.reduce((sum, page) => sum + page.notes.length, 0);
    },
    enabled: Boolean(patientId || taskId) && Boolean(oystehrZambda),
  });
};
