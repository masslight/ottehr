import {
  QueryClient,
  useMutation,
  UseMutationResult,
  useQuery,
  useQueryClient,
  UseQueryResult,
} from '@tanstack/react-query';
import { PatientNoteDTO } from 'utils/lib/types/api/patient-notes/patient-notes.types';
import { getPatientNotes, markTaskNotesRead } from '../../../api/api';
import { useApiClients } from '../../../hooks/useAppClients';

const TASK_BOARD_NOTES_KEY = ['patient-notes', 'tasks'];

/** Every note on the given tasks in one request, newest first. */
export const useTaskNotes = (taskIds: string[]): UseQueryResult<PatientNoteDTO[], Error> => {
  const { oystehrZambda } = useApiClients();
  return useQuery({
    queryKey: [...TASK_BOARD_NOTES_KEY, taskIds],
    queryFn: async () => {
      if (!oystehrZambda) throw new Error('API client not available');
      return (await getPatientNotes(oystehrZambda, { taskIds })).notes;
    },
    enabled: taskIds.length > 0 && Boolean(oystehrZambda),
    refetchInterval: 30000,
  });
};

/** The Tasks board pages that show this task, for its unread dot and preview. */
export const invalidateTaskBoardNotes = (queryClient: QueryClient, taskId: string): void => {
  void queryClient.invalidateQueries({
    queryKey: TASK_BOARD_NOTES_KEY,
    predicate: ({ queryKey: [, , taskIds] }) => Array.isArray(taskIds) && taskIds.includes(taskId),
  });
};

export const useMarkTaskNotesRead = (): UseMutationResult<void, Error, string> => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (taskId: string) => {
      if (!oystehrZambda) throw new Error('API client not available');
      await markTaskNotesRead(oystehrZambda, { taskId });
    },
    // Only the board shows whether notes are read; the open discussion has nothing to refresh.
    onSuccess: (_result, taskId) => invalidateTaskBoardNotes(queryClient, taskId),
  });
};
