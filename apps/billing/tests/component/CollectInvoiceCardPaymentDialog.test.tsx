import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactElement, ReactNode } from 'react';
import { BillingCard } from 'utils/lib/types/data/billing/billing.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CollectInvoiceCardPaymentDialog } from '../../src/components/CollectInvoiceCardPaymentDialog';

const mocks = vi.hoisted(() => ({
  listCards: vi.fn(),
  setup: vi.fn(),
  charge: vi.fn(),
  onClose: vi.fn(),
  onPaid: vi.fn(),
  client: {},
}));
vi.mock('../../src/api/api', () => ({
  listBillingNioInvoicePaymentMethods: mocks.listCards,
  setupBillingNioInvoiceCard: mocks.setup,
  chargeBillingNioInvoiceCard: mocks.charge,
}));
vi.mock('../../src/hooks/useAppClients', () => ({
  useApiClients: () => ({
    oystehrZambda: mocks.client,
  }),
}));
vi.mock('ui-components/lib/utils/stripe', () => ({
  loadStripe: vi.fn(),
}));
vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: ReactNode }): ReactNode => children,
}));
vi.mock('ui-components/lib/components/AddCreditCardForm', () => ({
  AddCreditCardForm: ({ selectPaymentMethod }: { selectPaymentMethod: (id: string) => void }): ReactElement => (
    <button type="button" onClick={() => selectPaymentMethod('pm_new')}>
      Save card
    </button>
  ),
}));

const card = (id: string, lastFour: string, isDefault = false): BillingCard => ({
  id,
  brand: 'visa',
  lastFour,
  expMonth: 12,
  expYear: 2099,
  default: isDefault,
});

const renderDialog = (): void => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <CollectInvoiceCardPaymentDialog
        open
        onClose={mocks.onClose}
        onPaid={mocks.onPaid}
        invoice={{
          id: 'invoice-1',
          balance: 320,
        }}
      />
    </QueryClientProvider>
  );
};

const chargeButton = (): HTMLElement =>
  within(screen.getByRole('dialog')).getByRole('button', {
    name: 'Charge card',
  });

describe('CollectInvoiceCardPaymentDialog', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.listCards.mockResolvedValue({
      cards: [card('pm_1', '4242', true), card('pm_2', '1881')],
    });
    mocks.setup.mockResolvedValue({
      clientSecret: 'seti_secret',
      stripeAccount: 'acct_1',
    });
    mocks.charge.mockResolvedValue({
      paymentId: 'payment-1',
    });
  });

  it('charges the whole balance to the first saved card', async () => {
    const user = userEvent.setup();
    renderDialog();
    await screen.findByText(/4242/);
    const amount = screen.getByRole('textbox', { name: 'Amount' });
    expect(amount).toHaveValue('320.00');
    expect(amount).toBeDisabled();

    await user.click(chargeButton());

    await waitFor(() => expect(mocks.onPaid).toHaveBeenCalled());
    expect(mocks.charge).toHaveBeenCalledWith(mocks.client, {
      invoiceId: 'invoice-1',
      amountInCents: 32000,
      paymentMethodId: 'pm_1',
      idempotencyKey: expect.any(String),
    });
    expect(mocks.onClose).toHaveBeenCalled();
  });

  it('resends a failed charge to the same card under the same key, and keeps the dialog open with the error', async () => {
    const user = userEvent.setup();
    mocks.charge.mockRejectedValueOnce(new Error('Network error'));
    renderDialog();
    await screen.findByText(/4242/);

    await user.click(chargeButton());

    expect(await screen.findByText('Network error')).toBeInTheDocument();
    expect(mocks.onClose).not.toHaveBeenCalled();
    await user.click(chargeButton());
    await waitFor(() => expect(mocks.onPaid).toHaveBeenCalled());
    const [[, first], [, second]] = mocks.charge.mock.calls;
    expect(second.idempotencyKey).toBe(first.idempotencyKey);
  });

  it('selects a newly added card once the saved cards reload', async () => {
    const user = userEvent.setup();
    renderDialog();
    await screen.findByText(/4242/);
    mocks.listCards.mockResolvedValue({
      cards: [card('pm_1', '4242', true), card('pm_new', '5555')],
    });

    const addCard = screen.getByRole('button', { name: 'Add card' });
    await user.click(addCard);
    const saveCard = await screen.findByRole('button', { name: 'Save card' });
    expect(chargeButton()).toBeDisabled();
    await user.click(saveCard);
    await screen.findByText(/5555/);
    await user.click(chargeButton());

    await waitFor(() => expect(mocks.charge).toHaveBeenCalled());
    expect(mocks.setup).toHaveBeenCalledWith(mocks.client, {
      invoiceId: 'invoice-1',
    });
    expect(mocks.charge).toHaveBeenCalledWith(
      mocks.client,
      expect.objectContaining({
        paymentMethodId: 'pm_new',
      })
    );
  });

  it('asks for a card when the payer has none saved', async () => {
    mocks.listCards.mockResolvedValue({
      cards: [],
    });
    renderDialog();

    expect(await screen.findByText('This payer has no saved cards. Add one to charge it.')).toBeInTheDocument();
    expect(chargeButton()).toBeDisabled();
  });
});
