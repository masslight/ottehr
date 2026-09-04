import { useMutation, UseMutationResult, useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { safelyCaptureException } from 'utils/lib/frontend/sentry';
import {
  GetVitalsAlertConfigOutput,
  UpdateVitalsAlertConfigInput,
} from 'utils/lib/types/api/vitals-alert-config/vitals-alert-config.types';
import { adminUpdateVitalsAlertConfig, getVitalsAlertConfig } from '../api/api';
import { useApiClients } from './useAppClients';

const VITALS_ALERT_CONFIG_QUERY_KEY = 'vitals-alert-config';

export function useVitalsAlertConfig(): UseQueryResult<GetVitalsAlertConfigOutput, Error> {
  const { oystehrZambda } = useApiClients();

  return useQuery({
    queryKey: [VITALS_ALERT_CONFIG_QUERY_KEY],
    queryFn: () => getVitalsAlertConfig(oystehrZambda!),
    enabled: !!oystehrZambda,
    staleTime: 5 * 60_000,
  });
}

export function useUpdateVitalsAlertConfig(): UseMutationResult<void, Error, UpdateVitalsAlertConfigInput> {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['admin-update-vitals-alert-config'],
    mutationFn: async (input: UpdateVitalsAlertConfigInput) => {
      if (!oystehrZambda) {
        throw new Error('oystehr client is undefined');
      }
      await adminUpdateVitalsAlertConfig(oystehrZambda, input);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: [VITALS_ALERT_CONFIG_QUERY_KEY],
      });
      enqueueSnackbar('Vital alert levels updated', {
        variant: 'success',
      });
    },
    onError: (error: Error) => {
      safelyCaptureException(error);
      enqueueSnackbar('Failed to update vital alert levels.', {
        variant: 'error',
      });
    },
  });
}
