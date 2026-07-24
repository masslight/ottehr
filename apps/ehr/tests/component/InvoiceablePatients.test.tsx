import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { GET_INVOICES_TASKS_ZAMBDA_KEY, InvoiceTaskSource } from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import InvoiceablePatients from '../../src/pages/reports/InvoiceablePatients';

const mockExecute = vi.fn();

vi.mock('../../src/hooks/useAppClients', () => ({
  useApiClients: () => ({
    oystehrZambda: {
      zambda: {
        execute: (...args: unknown[]) => mockExecute(...args),
      },
    },
    oystehr: {
      fhir: {
        search: vi.fn(),
      },
    },
  }),
}));

vi.mock('../../src/hooks/useLocationSupportPhones', () => ({
  useSupportPhonesMap: () => ({ phonesByLocationName: {} }),
}));

vi.mock('../../src/api/api', () => ({
  updateInvoiceTask: vi.fn(),
}));

vi.mock('src/components/dialogs', () => ({
  SendInvoiceToPatientDialog: () => null,
  SendStatementToPatientDialog: () => null,
}));

vi.mock('src/features/chat/ChatModal', () => ({
  default: () => null,
}));

vi.mock('../../src/constants/feature-flags', () => ({
  FEATURE_FLAGS: {
    OTTEHR_BILLING_INVOICING_ENABLED: true,
  },
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
};

const renderWithSource = (source: InvoiceTaskSource): ReturnType<typeof render> =>
  render(<InvoiceablePatients source={source} />, { wrapper: createWrapper() });

const lastGetInvoicesCall = (): Record<string, unknown> | undefined =>
  [...mockExecute.mock.calls]
    .reverse()
    .find((call) => (call[0] as { id: string }).id === GET_INVOICES_TASKS_ZAMBDA_KEY)?.[0];

describe('InvoiceablePatients source', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    window.history.pushState({}, '', '/');
    mockExecute.mockResolvedValue({
      output: {
        reports: [],
        totalCount: 0,
      },
    });
  });

  it('requests billing-sourced tasks on the ottehr-billing screen', async () => {
    renderWithSource('ottehr-billing');

    await waitFor(() => expect(lastGetInvoicesCall()).toBeDefined());
    expect(lastGetInvoicesCall()).toEqual(
      expect.objectContaining({
        id: GET_INVOICES_TASKS_ZAMBDA_KEY,
        source: 'ottehr-billing',
      })
    );
  });

  it('requests candid-sourced tasks on the candid screen', async () => {
    renderWithSource('candid');

    await waitFor(() => expect(lastGetInvoicesCall()).toBeDefined());
    expect(lastGetInvoicesCall()).toEqual(
      expect.objectContaining({
        id: GET_INVOICES_TASKS_ZAMBDA_KEY,
        source: 'candid',
      })
    );
  });

  it('shows the source chip when both screens are enabled', async () => {
    renderWithSource('ottehr-billing');

    const chip = await screen.findByText('Ottehr Billing');
    expect(chip).toBeDefined();

    renderWithSource('candid');
    const candidChip = await screen.findByText('Candid');
    expect(candidChip).toBeDefined();
  });

  it('omits the hide-$0 filter and does not hide $0 balances on the ottehr-billing screen', async () => {
    renderWithSource('ottehr-billing');

    await waitFor(() => expect(lastGetInvoicesCall()).toBeDefined());
    expect(lastGetInvoicesCall()?.hideZeroBalance).toBe(false);

    const checkbox = screen.queryByRole('checkbox', { name: /hide \$0 balances/i });
    expect(checkbox).toBeNull();
  });

  it('keeps the hide-$0 filter defaulting on for the candid screen', async () => {
    renderWithSource('candid');

    await waitFor(() => expect(lastGetInvoicesCall()).toBeDefined());
    expect(lastGetInvoicesCall()?.hideZeroBalance).toBe(true);

    const checkbox = screen.getByRole('checkbox', { name: /hide \$0 balances/i });
    expect(checkbox).toBeDefined();
  });

  it('restores persisted filters from the per-source storage key only', async () => {
    localStorage.setItem('invoices-tasks.filters.candid', JSON.stringify({ patient: 'pat-persisted' }));

    renderWithSource('ottehr-billing');
    await waitFor(() => expect(lastGetInvoicesCall()).toBeDefined());
    expect(lastGetInvoicesCall()?.patientId).toBeUndefined();
  });

  it('restores persisted filters for the matching source', async () => {
    localStorage.setItem('invoices-tasks.filters.candid', JSON.stringify({ patient: 'pat-persisted' }));

    renderWithSource('candid');
    await waitFor(() => expect(lastGetInvoicesCall()?.patientId).toBe('pat-persisted'));
  });
});
