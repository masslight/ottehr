import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { ReactNode } from 'react';
import { BILLING_INVOICE_LIMITS } from 'utils/lib/types/data/billing/billing.constants';
import { describe, expect, it, vi } from 'vitest';
import { useNioInvoiceDisabledReason } from '../../src/hooks/useNioInvoiceDisabledReason';

const mocks = vi.hoisted(() => ({
  check: vi.fn(),
}));
vi.mock('../../src/api/api', () => ({
  checkBillingNioInvoice: mocks.check,
}));
vi.mock('../../src/hooks/useAppClients', () => ({
  useApiClients: () => ({
    oystehrZambda: {},
  }),
}));

function wrapper({ children }: { children: ReactNode }): JSX.Element {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('useNioInvoiceDisabledReason', () => {
  it('names the claim cap without checking more claims than an invoice can hold', () => {
    const claimIds = Array.from({ length: BILLING_INVOICE_LIMITS.nioInvoiceClaimCount + 1 }, (_, i) => `c-${i}`);

    const { result } = renderHook(() => useNioInvoiceDisabledReason(claimIds, true), {
      wrapper,
    });

    expect(result.current).toBe(`An invoice can hold at most ${BILLING_INVOICE_LIMITS.nioInvoiceClaimCount} claims.`);
    expect(mocks.check).not.toHaveBeenCalled();
  });
});
