import { useMutation, UseMutationResult, useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { FEATURE_FLAGS } from 'src/constants/feature-flags';
import { useApiClients } from 'src/hooks/useAppClients';
import { InvoiceConfigResponse, SaveInvoiceConfigInput } from 'utils/lib/types/api/invoice-config.types';
import { getInvoiceConfig, saveInvoiceConfig } from './invoice-config.api';

const INVOICE_CONFIG_QUERY_KEY = ['invoice-config'];

export const useGetInvoiceConfigQuery = (enabled = true): UseQueryResult<InvoiceConfigResponse, Error> => {
  const { oystehrZambda } = useApiClients();

  return useQuery({
    queryKey: INVOICE_CONFIG_QUERY_KEY,
    queryFn: async () => {
      if (!oystehrZambda) throw new Error('OystehrZambda is not defined');
      return getInvoiceConfig(oystehrZambda);
    },
    enabled: enabled && !!oystehrZambda,
  });
};

// Ottehr billing invoicing runs in the EHR until the INVOICING_IN_BILLING_APP secret moves it to the billing app.
export const useOttehrBillingInvoicingInEhr = (): boolean => {
  const { data } = useGetInvoiceConfigQuery(FEATURE_FLAGS.OTTEHR_BILLING_INVOICING_ENABLED);
  return FEATURE_FLAGS.OTTEHR_BILLING_INVOICING_ENABLED && !!data && !data.invoicingInBillingApp;
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
