import { useMutation, UseMutationResult, useQueryClient } from '@tanstack/react-query';
import { deletePatientNote } from '../../../api/api';
import { useApiClients } from '../../../hooks/useAppClients';

export const useDeletePatientNote = (patientId: string | undefined): UseMutationResult<void, Error, string> => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (resourceId: string): Promise<void> => {
      if (!oystehrZambda) throw new Error('API client not available');
      await deletePatientNote(oystehrZambda, { resourceId });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['patient-notes', { patientId }] });
    },
  });
};
