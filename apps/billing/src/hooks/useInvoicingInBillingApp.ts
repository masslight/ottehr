import { useQuery } from '@tanstack/react-query';
import { getInvoiceConfig } from '../api/api';
import { useApiClients } from './useAppClients';

// The INVOICING_IN_BILLING_APP secret can change without a deploy, so the backend reports it.
export function useInvoicingInBillingApp(): boolean {
  const { oystehrZambda } = useApiClients();
  const { data } = useQuery({
    queryKey: ['billing-invoice-config'],
    enabled: Boolean(oystehrZambda),
    queryFn: () => getInvoiceConfig(oystehrZambda!),
  });
  return data?.invoicingInBillingApp ?? false;
}
