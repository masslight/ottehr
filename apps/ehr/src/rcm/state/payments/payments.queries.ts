import { useMutation, UseMutationResult, useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { useApiClients } from 'src/hooks/useAppClients';
import {
  getPaymentLocations,
  getStripeAccountInfo,
  GetStripeAccountInfoResponse,
  getTerminalReaders,
  GetTerminalReadersResponse,
  PaymentLocation,
  saveTerminalLocation,
} from './payments.api';

export const usePaymentLocationsQuery = (): UseQueryResult<PaymentLocation[], Error> => {
  const { oystehrZambda } = useApiClients();

  return useQuery({
    queryKey: ['rcm-payment-locations'],

    queryFn: async () => {
      if (!oystehrZambda) throw new Error('OystehrZambda is not defined');

      const result = await getPaymentLocations(oystehrZambda);
      return result.locations;
    },

    enabled: !!oystehrZambda,
  });
};

export const useStripeAccountInfoQuery = (
  stripeAccountId: string | undefined
): UseQueryResult<GetStripeAccountInfoResponse, Error> => {
  const { oystehrZambda } = useApiClients();

  return useQuery({
    queryKey: ['rcm-stripe-account-info', stripeAccountId],

    queryFn: async () => {
      if (!oystehrZambda) throw new Error('OystehrZambda is not defined');
      if (!stripeAccountId) throw new Error('stripeAccountId is required');

      return getStripeAccountInfo(oystehrZambda, stripeAccountId);
    },

    enabled: !!oystehrZambda && !!stripeAccountId,
  });
};

export const useSaveTerminalLocationMutation = (): UseMutationResult<
  { success: boolean },
  Error,
  { locationId: string; terminalLocationId: string | null }
> => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ locationId, terminalLocationId }) => {
      if (!oystehrZambda) throw new Error('OystehrZambda is not defined');
      return saveTerminalLocation(oystehrZambda, locationId, terminalLocationId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['rcm-payment-locations'] });
    },
  });
};

export const useTerminalReadersQuery = (
  stripeAccountId: string | undefined,
  terminalLocationId: string | undefined
): UseQueryResult<GetTerminalReadersResponse, Error> => {
  const { oystehrZambda } = useApiClients();

  return useQuery({
    queryKey: ['rcm-terminal-readers', stripeAccountId, terminalLocationId],

    queryFn: async () => {
      if (!oystehrZambda) throw new Error('OystehrZambda is not defined');
      if (!stripeAccountId) throw new Error('stripeAccountId is required');
      if (!terminalLocationId) throw new Error('terminalLocationId is required');

      return getTerminalReaders(oystehrZambda, stripeAccountId, terminalLocationId);
    },

    enabled: !!oystehrZambda && !!stripeAccountId && !!terminalLocationId,
  });
};
