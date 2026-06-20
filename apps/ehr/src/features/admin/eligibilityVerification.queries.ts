import { useMutation, UseMutationResult, useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { adminUpdateEligibilityVerificationConfig, getEligibilityVerificationConfig } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import {
  AdminUpdateEligibilityVerificationConfigInput,
  APIError,
  GetEligibilityVerificationConfigOutput,
  isApiError,
} from 'utils';

export const ELIGIBILITY_VERIFICATION_CONFIG_QUERY_KEY = 'eligibility-verification-config';

export const useEligibilityVerificationConfig = (): UseQueryResult<GetEligibilityVerificationConfigOutput, Error> => {
  const { oystehrZambda } = useApiClients();

  return useQuery({
    queryKey: [ELIGIBILITY_VERIFICATION_CONFIG_QUERY_KEY],
    queryFn: async () => getEligibilityVerificationConfig(oystehrZambda!),
    enabled: !!oystehrZambda,
    staleTime: 5 * 60_000,
  });
};

export const useAdminUpdateEligibilityVerificationConfig = (): UseMutationResult<
  void,
  Error,
  AdminUpdateEligibilityVerificationConfigInput
> => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();

  return useMutation<void, Error, AdminUpdateEligibilityVerificationConfigInput>({
    mutationKey: ['admin-update-eligibility-verification-config'],
    mutationFn: async (input: AdminUpdateEligibilityVerificationConfigInput) => {
      if (!oystehrZambda) throw new Error('oystehr client is undefined');
      await adminUpdateEligibilityVerificationConfig(oystehrZambda, input);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [ELIGIBILITY_VERIFICATION_CONFIG_QUERY_KEY] });
      enqueueSnackbar('Eligibility Verification configuration saved', { variant: 'success' });
    },
    onError: (error: Error) => {
      let message = 'Failed to save Eligibility Verification configuration.';
      if (isApiError(error)) message = (error as APIError).message;
      enqueueSnackbar(message, { variant: 'error' });
    },
  });
};
