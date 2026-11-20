import { useQuery } from '@tanstack/react-query';
import { getInvoiceConfig } from '../api/api';
import { useApiClients } from './useAppClients';

// The INVOICING_IN_BILLING_APP secret can change without a deploy, so the backend reports it.
// undefined until the backend answers.
export function useInvoicingInBillingApp(): boolean | undefined {
  const { oystehrZambda } = useApiClients();
  const { data, isError } = useQuery({
    queryKey: ['billing-invoice-config'],
    enabled: Boolean(oystehrZambda),
    queryFn: () => getInvoiceConfig(oystehrZambda!),
  });
  if (data) return data.invoicingInBillingApp;
  return isError ? false : undefined;
}
