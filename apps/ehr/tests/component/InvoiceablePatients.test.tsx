import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Task } from 'fhir/r4b';
import { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import {
  GET_INVOICES_TASKS_ZAMBDA_KEY,
  InvoiceablePatientReport,
  InvoiceTaskSource,
} from 'utils/lib/types/api/invoicing.types';
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

vi.mock('notistack', () => ({
  enqueueSnackbar: vi.fn(),
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

// ─── invoice status hover card ────────────────────────────────────────────────

const INVOICE_ID_CODE = 'send-invoice-output-invoice-Id';
const ERROR_CODE = 'send-invoice-output-error';

const makeTask = (status: Task['status'], output?: Task['output']): Task => ({
  resourceType: 'Task',
  status,
  intent: 'order',
  output,
});

const makeReport = (task: Task): InvoiceablePatientReport => ({
  claimId: 'claim-abc-123',
  finalizationDateISO: '2025-01-15',
  amountInvoiceable: 5000,
  visitDate: 'Jan 1, 2025',
  location: 'Test Clinic',
  task,
  patient: { patientId: 'patient-1', fullName: 'Jane Doe', phoneNumber: '555-1234' },
  responsibleParty: {},
});

const mockOneReport = (report: InvoiceablePatientReport): void => {
  mockExecute.mockResolvedValue({ output: { reports: [report], totalCount: 1 } });
};

describe('invoice status hover card', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    window.history.pushState({}, '', '/');
  });

  it('shows the invoice ID in the tooltip when hovering a sent-status chip', async () => {
    const user = userEvent.setup();
    mockOneReport(
      makeReport(
        makeTask('completed', [{ type: { coding: [{ code: INVOICE_ID_CODE }] }, valueString: 'in_test_invoice_123' }])
      )
    );
    renderWithSource('candid');

    const chip = await screen.findByTestId('telemed-appointment-status-chip');
    await user.hover(chip);

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent('Last invoice ID');
    expect(tooltip).toHaveTextContent('in_test_invoice_123');
  });

  it('copies the invoice ID to clipboard when the copy button is clicked', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, writable: true, configurable: true });

    mockOneReport(
      makeReport(
        makeTask('completed', [{ type: { coding: [{ code: INVOICE_ID_CODE }] }, valueString: 'in_test_invoice_123' }])
      )
    );
    renderWithSource('candid');

    const chip = await screen.findByTestId('telemed-appointment-status-chip');
    await user.hover(chip);

    const copyIcon = await screen.findByTestId('ContentCopyIcon');
    await user.click(copyIcon.closest('button')!);

    expect(writeText).toHaveBeenCalledWith('in_test_invoice_123');
  });

  it('shows only the error message when the task is in error state with no prior invoice', async () => {
    const user = userEvent.setup();
    mockOneReport(
      makeReport(
        makeTask('failed', [{ type: { coding: [{ code: ERROR_CODE }] }, valueString: 'Stripe error: invalid email' }])
      )
    );
    renderWithSource('candid');

    const chip = await screen.findByTestId('telemed-appointment-status-chip');
    await user.hover(chip);

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent('Error');
    expect(tooltip).toHaveTextContent('Stripe error: invalid email');
    expect(tooltip).not.toHaveTextContent('Invoice ID');
  });

  it('shows both invoice ID and error message when a task failed after a successful send', async () => {
    const user = userEvent.setup();
    mockOneReport(
      makeReport(
        makeTask('failed', [
          { type: { coding: [{ code: INVOICE_ID_CODE }] }, valueString: 'in_prior_invoice_456' },
          { type: { coding: [{ code: ERROR_CODE }] }, valueString: 'Retry failed: customer deleted' },
        ])
      )
    );
    renderWithSource('candid');

    const chip = await screen.findByTestId('telemed-appointment-status-chip');
    await user.hover(chip);

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent('Last invoice ID');
    expect(tooltip).toHaveTextContent('in_prior_invoice_456');
    expect(tooltip).toHaveTextContent('Error');
    expect(tooltip).toHaveTextContent('Retry failed: customer deleted');
  });

  it('does not show a tooltip for a ready-status chip with no task output', async () => {
    const user = userEvent.setup();
    mockOneReport(makeReport(makeTask('ready')));
    renderWithSource('candid');

    const chip = await screen.findByTestId('telemed-appointment-status-chip');
    await user.hover(chip);

    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});
