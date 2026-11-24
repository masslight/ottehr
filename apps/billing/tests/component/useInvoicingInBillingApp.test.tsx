import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useInvoicingInBillingApp } from '../../src/hooks/useInvoicingInBillingApp';

const mocks = vi.hoisted(() => ({
  getInvoiceConfig: vi.fn(),
}));
vi.mock('../../src/api/api', () => ({
  getInvoiceConfig: mocks.getInvoiceConfig,
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

describe('useInvoicingInBillingApp', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('is unknown until the invoice config loads', () => {
    mocks.getInvoiceConfig.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useInvoicingInBillingApp(), {
      wrapper,
    });

    expect(result.current).toBeUndefined();
  });

  it('reports what the invoice config says', async () => {
    mocks.getInvoiceConfig.mockResolvedValue({
      invoicingInBillingApp: true,
    });

    const { result } = renderHook(() => useInvoicingInBillingApp(), {
      wrapper,
    });

    await waitFor(() => expect(result.current).toBe(true));
  });

  it('treats invoicing as off when the config fails to load', async () => {
    mocks.getInvoiceConfig.mockRejectedValue(new Error('Config failed'));

    const { result } = renderHook(() => useInvoicingInBillingApp(), {
      wrapper,
    });

    await waitFor(() => expect(result.current).toBe(false));
  });
});
