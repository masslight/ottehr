import { useQuery } from '@tanstack/react-query';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import { BILLING_INVOICE_LIMITS } from 'utils/lib/types/data/billing/billing.constants';
import { checkBillingNioInvoice } from '../api/api';
import { useApiClients } from './useAppClients';

export const NIO_INVOICE_REQUIREMENTS =
  'Claims on one invoice must be in Non-Insurance Payer AR with a status of Ready to invoice, share one ' +
  'non-insurance organization and issuer, have a balance, and not already be on an invoice.';

export function useNioInvoiceDisabledReason(claimIds: string[], enabled: boolean): string | undefined {
  const { oystehrZambda } = useApiClients();
  const tooManyClaims = claimIds.length > BILLING_INVOICE_LIMITS.nioInvoiceClaimCount;
  const check = useQuery({
    queryKey: ['billing-nio-invoice-check', claimIds],
    enabled: enabled && Boolean(oystehrZambda) && claimIds.length > 0 && !tooManyClaims,
    staleTime: 0,
    retry: false,
    queryFn: () =>
      checkBillingNioInvoice(oystehrZambda!, {
        claimIds,
      }),
  });

  if (tooManyClaims) {
    return `An invoice can hold at most ${BILLING_INVOICE_LIMITS.nioInvoiceClaimCount} claims.`;
  }
  if (check.isFetching || check.isPending) return 'Checking the selected claims…';
  if (check.isError) {
    return getApiError({
      error: check.error,
      defaultError: 'Failed to check the selected claims',
    });
  }
  if (!check.data.invoiceable) return `${NIO_INVOICE_REQUIREMENTS} ${check.data.reason}.`;
  return undefined;
}
