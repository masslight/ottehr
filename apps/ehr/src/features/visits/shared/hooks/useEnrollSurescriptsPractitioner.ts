import { useMutation, UseMutationResult, useQueryClient } from '@tanstack/react-query';
import { enrollPractitioner } from 'src/api/api';
import { useAuthToken } from 'src/hooks/useAuthToken';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { CheckPractitionerEnrollmentOutput } from 'utils/lib/types/api/practitioner-enrollment.types';

export const useEnrollSurescriptsPractitioner = (): UseMutationResult<
  CheckPractitionerEnrollmentOutput,
  Error,
  void
> => {
  const token = useAuthToken();
  const user = useEvolveUser();
  const queryClient = useQueryClient();
  const practitionerId = user?.profileResource?.id;

  return useMutation({
    mutationFn: async () => {
      if (!token || !practitionerId) {
        throw new Error('API client not available');
      }
      return enrollPractitioner(token, practitionerId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['surescripts-practitioner-enrollment'] }),
  });
};
