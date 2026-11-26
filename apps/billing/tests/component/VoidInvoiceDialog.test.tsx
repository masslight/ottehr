import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BILLING_INVOICE_LIMITS } from 'utils/lib/types/data/billing/billing.constants';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VoidInvoiceDialog } from '../../src/components/VoidInvoiceDialog';

const mocks = vi.hoisted(() => ({
  voidInvoice: vi.fn(),
  onClose: vi.fn(),
  onVoided: vi.fn(),
  client: {},
}));
vi.mock('../../src/api/api', () => ({
  voidBillingNioInvoice: mocks.voidInvoice,
}));
vi.mock('../../src/hooks/useAppClients', () => ({
  useApiClients: () => ({
    oystehrZambda: mocks.client,
  }),
}));

const renderDialog = (): void => {
  render(
    <VoidInvoiceDialog
      open
      onClose={mocks.onClose}
      onVoided={mocks.onVoided}
      invoice={{
        id: 'invoice-1',
        number: 'INV-00042',
        amount: 320,
      }}
    />
  );
};

const typeReason = (value: string): void => {
  const reason = screen.getByRole('textbox', { name: 'Reason *' });
  fireEvent.change(reason, {
    target: {
      value,
    },
  });
};

describe('VoidInvoiceDialog', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.voidInvoice.mockResolvedValue({
      ok: true,
    });
  });

  it('names the invoice and amount, and needs a reason', () => {
    renderDialog();

    expect(
      screen.getByText(
        'Are you sure you want to void invoice INV-00042 for $320.00? A voided invoice can no longer be paid.'
      )
    ).toBeInTheDocument();
    const confirm = screen.getByRole('button', { name: 'Void' });
    expect(confirm).toBeDisabled();
    typeReason('   ');
    expect(confirm).toBeDisabled();
  });

  it('voids the invoice with the trimmed reason, then closes and refreshes', async () => {
    renderDialog();

    typeReason(' Billed the wrong payer ');
    const confirm = screen.getByRole('button', { name: 'Void' });
    fireEvent.click(confirm);

    await waitFor(() => expect(mocks.onVoided).toHaveBeenCalled());
    expect(mocks.voidInvoice).toHaveBeenCalledWith(mocks.client, {
      invoiceId: 'invoice-1',
      reason: 'Billed the wrong payer',
    });
    expect(mocks.onClose).toHaveBeenCalled();
  });

  it('refuses a reason over the length limit', () => {
    renderDialog();

    typeReason('x'.repeat(BILLING_INVOICE_LIMITS.voidReasonLength + 1));

    expect(screen.getByText(`No more than ${BILLING_INVOICE_LIMITS.voidReasonLength} characters`)).toBeInTheDocument();
    const confirm = screen.getByRole('button', { name: 'Void' });
    expect(confirm).toBeDisabled();
  });

  it('stays open with the error when the void fails', async () => {
    mocks.voidInvoice.mockRejectedValue(new Error("Invoice INV-00042 is balanced, so it can't be voided"));
    renderDialog();

    typeReason('Billed the wrong payer');
    const confirm = screen.getByRole('button', { name: 'Void' });
    fireEvent.click(confirm);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("Invoice INV-00042 is balanced, so it can't be voided");
    expect(mocks.onClose).not.toHaveBeenCalled();
    expect(mocks.onVoided).not.toHaveBeenCalled();
  });
});
