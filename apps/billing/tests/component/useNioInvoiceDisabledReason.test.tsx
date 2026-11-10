import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { BILLING_INVOICE_LIMITS } from 'utils/lib/types/data/billing/billing.constants';
import { describe, expect, it, vi } from 'vitest';
import { NIO_INVOICE_CHECKING, useNioInvoiceDisabledReason } from '../../src/hooks/useNioInvoiceDisabledReason';

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

  it('reports the check while it runs', () => {
    mocks.check.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useNioInvoiceDisabledReason(['c-1'], true), {
      wrapper,
    });

    expect(result.current).toBe(NIO_INVOICE_CHECKING);
  });

  it('gives only the rule the claims break', async () => {
    mocks.check.mockResolvedValue({
      invoiceable: false,
      reason: 'Test3, Omar (2026-11-10) must be in Non-Insurance Payer AR with a status of Ready to invoice',
    });

    const { result } = renderHook(() => useNioInvoiceDisabledReason(['c-1'], true), {
      wrapper,
    });

    await waitFor(() =>
      expect(result.current).toBe(
        'Test3, Omar (2026-11-10) must be in Non-Insurance Payer AR with a status of Ready to invoice.'
      )
    );
  });
});
