import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NonInsuranceOrganizationItem } from 'utils/lib/types/data/billing/non-insurance-org.types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NioInvoiceDialog } from '../../src/components/NioInvoiceDialog';

const mocks = vi.hoisted(() => ({
  preview: vi.fn(),
  create: vi.fn(),
  searchNios: vi.fn(),
  downloadUrl: vi.fn(),
  snackbar: vi.fn(),
  client: {},
}));
vi.mock('../../src/api/api', () => ({
  previewBillingNioInvoice: mocks.preview,
  createBillingNioInvoice: mocks.create,
  searchBillingNonInsuranceOrgs: mocks.searchNios,
}));
vi.mock('../../src/hooks/useAppClients', () => ({
  useApiClients: () => ({
    oystehrZambda: mocks.client,
  }),
}));
vi.mock('notistack', () => ({
  enqueueSnackbar: mocks.snackbar,
}));
vi.mock('../../src/utils/downloadFile', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/utils/downloadFile')>()),
  downloadUrl: mocks.downloadUrl,
}));

const claimIds = ['claim-1', 'claim-2'];

const nio: NonInsuranceOrganizationItem = {
  id: 'nio-1',
  name: 'Acme Health Services',
  employer: true,
  active: true,
  contacts: [],
  covers: [
    {
      category: 'occupational-medicine',
    },
    {
      category: 'workers-comp',
      billingMode: 'direct',
      submission: {
        preferredMechanism: 'email',
        email: 'billing@acme.example',
        fax: '555-0100',
      },
    },
  ],
};

function renderDialog(): { onCreated: ReturnType<typeof vi.fn> } {
  const onCreated = vi.fn();
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <NioInvoiceDialog claimIds={claimIds} onClose={vi.fn()} onCreated={onCreated} />
    </QueryClientProvider>
  );
  return {
    onCreated,
  };
}

describe('NIO invoice dialog', () => {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  beforeEach(() => {
    vi.resetAllMocks();
    URL.createObjectURL = vi.fn(() => 'blob:invoice-preview');
    URL.revokeObjectURL = vi.fn();
    mocks.preview.mockResolvedValue({
      pdfBase64: btoa('%PDF-1.7'),
      recipient: {
        id: 'nio-1',
        name: 'Acme Health Services',
      },
    });
    mocks.searchNios.mockResolvedValue({
      organizations: [nio],
    });
    mocks.create.mockResolvedValue({
      invoiceId: 'invoice-1',
      invoiceNumber: 'INV-00007',
      pdfUrl: 'https://z3.example/INV-00007.pdf',
    });
    mocks.downloadUrl.mockResolvedValue(undefined);
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it('previews the invoice with the delivery details of the first coverage that has them', async () => {
    renderDialog();

    const preview = await screen.findByTitle('Invoice preview');
    expect(preview).toHaveAttribute('src', 'blob:invoice-preview');
    expect(mocks.preview).toHaveBeenCalledWith(mocks.client, {
      claimIds,
    });
    expect(screen.getByText('Acme Health Services · 2 claim(s)')).toBeInTheDocument();
    expect(await screen.findByText('billing@acme.example')).toBeInTheDocument();
    expect(mocks.searchNios).toHaveBeenCalledWith(mocks.client, {
      nioId: 'nio-1',
    });
    expect(screen.getByText('555-0100')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  it('creates the invoice, downloads its PDF and closes', async () => {
    const user = userEvent.setup();
    const { onCreated } = renderDialog();

    const createButton = await screen.findByRole('button', { name: 'Create Invoice' });
    await waitFor(() => expect(createButton).toBeEnabled());
    await user.click(createButton);

    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(mocks.create).toHaveBeenCalledWith(mocks.client, {
      claimIds,
      idempotencyKey: expect.any(String),
    });
    expect(mocks.downloadUrl).toHaveBeenCalledWith('INV-00007.pdf', 'https://z3.example/INV-00007.pdf');
    expect(mocks.snackbar).toHaveBeenCalledWith('Invoice INV-00007 created', {
      variant: 'success',
    });
  });

  it('keeps the dialog open on a failed create and retries with the same idempotency key', async () => {
    const user = userEvent.setup();
    mocks.create.mockRejectedValueOnce(new Error('Claims claim-2 are already on an invoice'));
    const { onCreated } = renderDialog();

    const createButton = await screen.findByRole('button', { name: 'Create Invoice' });
    await waitFor(() => expect(createButton).toBeEnabled());
    await user.click(createButton);

    expect(await screen.findByText('Claims claim-2 are already on an invoice')).toBeInTheDocument();
    expect(onCreated).not.toHaveBeenCalled();

    await user.click(createButton);

    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    const [[, firstAttempt], [, retry]] = mocks.create.mock.calls;
    expect(retry.idempotencyKey).toBe(firstAttempt.idempotencyKey);
  });

  it('still closes when the invoice was created but its PDF did not download', async () => {
    const user = userEvent.setup();
    mocks.downloadUrl.mockRejectedValue(new Error('Failed to download INV-00007.pdf: 403'));
    const { onCreated } = renderDialog();

    const createButton = await screen.findByRole('button', { name: 'Create Invoice' });
    await waitFor(() => expect(createButton).toBeEnabled());
    await user.click(createButton);

    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(mocks.snackbar).toHaveBeenCalledWith("Invoice INV-00007 was created, but its PDF didn't download", {
      variant: 'warning',
    });
  });

  it('shows a failed preview and does not allow creating', async () => {
    mocks.preview.mockRejectedValue(new Error('All claims must have the same service facility'));
    renderDialog();

    expect(await screen.findByText('All claims must have the same service facility')).toBeInTheDocument();
    const createButton = screen.getByRole('button', { name: 'Create Invoice' });
    expect(createButton).toBeDisabled();
  });
});
