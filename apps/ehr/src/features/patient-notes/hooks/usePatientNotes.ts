import { InfiniteData, QueryClient, useInfiniteQuery, UseInfiniteQueryResult } from '@tanstack/react-query';
import { GetPatientNotesOutput } from 'utils/lib/types/api/patient-notes/patient-notes.types';
import { getPatientNotes } from '../../../api/api';
import { useApiClients } from '../../../hooks/useAppClients';
import { invalidateTaskBoardNotes } from './useTaskNotes';

const PAGE_SIZE = 20;

export type NoteTarget = { patientId: string; taskId?: never } | { taskId: string; patientId?: never };

export const noteKind = (target: NoteTarget): 'task' | 'patient' => (target.taskId ? 'task' : 'patient');

export const invalidateNotes = (queryClient: QueryClient, target: NoteTarget): void => {
  void queryClient.invalidateQueries({ queryKey: ['patient-notes', target] });
  if (target.taskId) invalidateTaskBoardNotes(queryClient, target.taskId);
  else void queryClient.invalidateQueries({ queryKey: ['patient-notes-count', { patientId: target.patientId }] });
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
