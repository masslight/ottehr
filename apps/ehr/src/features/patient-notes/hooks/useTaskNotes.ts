import {
  InfiniteData,
  QueryClient,
  useMutation,
  UseMutationResult,
  useQuery,
  useQueryClient,
  UseQueryResult,
} from '@tanstack/react-query';
import {
  GetPatientNotesOutput,
  MarkTaskNotesReadInput,
  PatientNoteDTO,
} from 'utils/lib/types/api/patient-notes/patient-notes.types';
import { getPatientNotes, markTaskNotesRead } from '../../../api/api';
import { useApiClients } from '../../../hooks/useAppClients';

const TASK_BOARD_NOTES_KEY = ['patient-notes', 'tasks'];

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

export const invalidateTaskBoardNotes = (queryClient: QueryClient, taskId: string): void => {
  void queryClient.invalidateQueries({
    queryKey: TASK_BOARD_NOTES_KEY,
    predicate: ({ queryKey: [, , taskIds] }) => Array.isArray(taskIds) && taskIds.includes(taskId),
  });
};

export const useMarkTaskNotesRead = (): UseMutationResult<void, Error, MarkTaskNotesReadInput> => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: MarkTaskNotesReadInput) => {
      if (!oystehrZambda) throw new Error('API client not available');
      await markTaskNotesRead(oystehrZambda, input);
    },
    onSuccess: (_result, { taskId, noteIds }) => {
      const readIds = new Set(noteIds);
      queryClient.setQueryData<InfiniteData<GetPatientNotesOutput>>(['patient-notes', { taskId }], (data) =>
        data
          ? {
              ...data,
              pages: data.pages.map((page) => ({
                ...page,
                notes: page.notes.map((note) =>
                  note.resourceId && readIds.has(note.resourceId) ? { ...note, isUnread: false } : note
                ),
              })),
            }
          : undefined
      );
      invalidateTaskBoardNotes(queryClient, taskId);
    },
  });
};
