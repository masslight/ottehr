import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { BillingInvoiceDetail } from 'utils/lib/types/data/billing/billing.types';
import { AR_STAGE } from 'utils/lib/types/data/billing/claim-status';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import InvoiceDetail from '../../src/pages/InvoiceDetail';

const mocks = vi.hoisted(() => ({
  getInvoice: vi.fn(),
  downloadUrl: vi.fn(),
  client: {},
}));
vi.mock('../../src/api/api', () => ({
  getBillingInvoice: mocks.getInvoice,
}));
vi.mock('../../src/hooks/useAppClients', () => ({
  useApiClients: () => ({
    oystehrZambda: mocks.client,
  }),
}));
vi.mock('../../src/utils/downloadFile', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/utils/downloadFile')>()),
  downloadUrl: mocks.downloadUrl,
}));

const invoice: BillingInvoiceDetail = {
  id: 'invoice-1',
  status: 'issued',
  issueDate: '2026-09-01T15:00:00.000Z',
  dueDate: '2026-10-01',
  amount: 320,
  kind: 'nio',
  number: 'INV-00042',
  recipient: {
    id: 'nio-1',
    name: 'Acme Health Services',
  },
  balance: 140,
  pastDue: false,
  claims: [
    {
      claimId: 'claim-1',
      patientId: 'pat-1',
      patientName: 'Whitaker, Sam',
      serviceDate: '2026-08-04',
      arStage: AR_STAGE.nonInsurancePayer,
      status: 'invoiced',
      amount: 180,
    },
  ],
  payments: [
    {
      paymentNoticeId: 'notice-1',
      paymentDate: '2026-09-19',
      amount: 180,
      method: 'check',
      reference: '88123',
    },
  ],
  pdfUrl: 'https://z3.example/INV-00042.pdf',
};

function renderPage(): void {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/invoices/invoice-1']}>
        <Routes>
          <Route path="/invoices/:id" element={<InvoiceDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('InvoiceDetail', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getInvoice.mockResolvedValue(invoice);
    mocks.downloadUrl.mockResolvedValue(undefined);
  });

  it('shows the invoice with its payer, payments and claims', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'INV-00042' })).toBeInTheDocument();
    expect(mocks.getInvoice).toHaveBeenCalledWith(mocks.client, {
      invoiceId: 'invoice-1',
    });
    expect(screen.getByText('Open')).toBeInTheDocument();
    const payer = screen.getByRole('link', { name: 'Acme Health Services' });
    expect(payer).toHaveAttribute('href', '/non-insurance-organizations/nio-1');
    expect(screen.getByText('09/01/2026')).toBeInTheDocument();
    expect(screen.getByText('10/01/2026')).toBeInTheDocument();
    expect(screen.getByText('$320.00')).toBeInTheDocument();
    expect(screen.getByText('$140.00')).toBeInTheDocument();
    expect(screen.getByText('Check #88123 - $180.00')).toBeInTheDocument();
    const claimRow = within(screen.getByRole('link', { name: 'Whitaker, Sam' }).closest('tr')!);
    expect(claimRow.getByText('08/04/2026')).toBeInTheDocument();
    expect(claimRow.getByText('Non-insurance Payer AR')).toBeInTheDocument();
    expect(claimRow.getByText('Invoiced')).toBeInTheDocument();
    expect(claimRow.getByText('$180.00')).toBeInTheDocument();
  });

  it('shows a claim that was not found without a link to it', async () => {
    mocks.getInvoice.mockResolvedValue({
      ...invoice,
      claims: [
        {
          claimId: 'claim-gone',
          patientId: '',
          patientName: '',
          serviceDate: '',
          arStage: '',
          status: '',
          amount: 180,
        },
      ],
    });
    renderPage();

    const missingClaim = await screen.findByText('Claim not found');
    const row = within(missingClaim.closest('tr')!);
    expect(row.queryByRole('link')).not.toBeInTheDocument();
    expect(row.getByText('$180.00')).toBeInTheDocument();
  });

  it('shows a past-due invoice as past due', async () => {
    mocks.getInvoice.mockResolvedValue({
      ...invoice,
      pastDue: true,
    });
    renderPage();

    expect(await screen.findByText('Past due')).toBeInTheDocument();
    expect(screen.queryByText('Open')).not.toBeInTheDocument();
  });

  it('shows no balance rather than $0.00 when the balance is unknown', async () => {
    mocks.getInvoice.mockResolvedValue({
      ...invoice,
      balance: undefined,
    });
    renderPage();

    const balanceLabel = await screen.findByText('Balance');
    expect(balanceLabel.parentElement).toHaveTextContent('Balance-');
  });

  it('keeps the payment actions disabled', async () => {
    renderPage();

    await screen.findByRole('heading', { name: 'INV-00042' });
    const recordPayment = screen.getByRole('button', { name: 'Record payment' });
    const collectCardPayment = screen.getByRole('button', { name: 'Collect card payment' });
    expect(recordPayment).toBeDisabled();
    expect(collectCardPayment).toBeDisabled();
  });

  it('downloads the invoice PDF', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('heading', { name: 'INV-00042' });

    const download = screen.getByRole('button', { name: 'Download invoice' });
    await user.click(download);

    expect(mocks.downloadUrl).toHaveBeenCalledWith('INV-00042.pdf', 'https://z3.example/INV-00042.pdf');
  });

  it('shows the error when the invoice fails to load', async () => {
    mocks.getInvoice.mockRejectedValue(new Error('Only non-insurance payer invoices have a details view'));
    renderPage();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Only non-insurance payer invoices have a details view');
  });
});
