import { useMutation, UseMutationResult, useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { PatientNoteDTO } from 'utils/lib/types/api/patient-notes/patient-notes.types';
import { getPatientNotes, markTaskNotesRead } from '../../../api/api';
import { useApiClients } from '../../../hooks/useAppClients';
import { invalidateNotes } from './usePatientNotes';

/** Every note on the given tasks in one request, newest first. */
export const useTaskNotes = (taskIds: string[]): UseQueryResult<PatientNoteDTO[], Error> => {
  const { oystehrZambda } = useApiClients();
  return useQuery({
    queryKey: ['patient-notes', 'tasks', taskIds],
    queryFn: async () => (await getPatientNotes(oystehrZambda!, { taskIds })).notes,
    enabled: taskIds.length > 0 && Boolean(oystehrZambda),
    refetchInterval: 30000,
  });
};

export const useMarkTaskNotesRead = (): UseMutationResult<void, Error, string> => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => markTaskNotesRead(oystehrZambda!, { taskId }),
    onSuccess: () => invalidateNotes(queryClient),
  });
};
