import { useMutation, UseMutationResult, useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { useApiClients } from 'src/hooks/useAppClients';
import {
  getInvoiceConfig,
  InvoiceConfigResponse,
  saveInvoiceConfig,
  SaveInvoiceConfigInput,
} from './invoice-config.api';

const INVOICE_CONFIG_QUERY_KEY = ['invoice-config'];

export const useGetInvoiceConfigQuery = (): UseQueryResult<InvoiceConfigResponse, Error> => {
  const { oystehrZambda } = useApiClients();

  return useQuery({
    queryKey: INVOICE_CONFIG_QUERY_KEY,
    queryFn: async () => {
      if (!oystehrZambda) throw new Error('OystehrZambda is not defined');
      return getInvoiceConfig(oystehrZambda);
    },
    enabled: !!oystehrZambda,
  });
};

export const useSaveInvoiceConfigMutation = (): UseMutationResult<
  InvoiceConfigResponse,
  Error,
  SaveInvoiceConfigInput
> => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['save-invoice-config'],
    mutationFn: async (data: SaveInvoiceConfigInput) => {
      if (!oystehrZambda) throw new Error('OystehrZambda is not defined');
      return saveInvoiceConfig(oystehrZambda, data);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(INVOICE_CONFIG_QUERY_KEY, data);
    },
  });
};
