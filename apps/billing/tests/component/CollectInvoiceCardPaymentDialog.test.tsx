import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactElement, ReactNode, useState } from 'react';
import { BillingCard } from 'utils/lib/types/data/billing/billing.types';
import { APIErrorCode } from 'utils/lib/types/errors';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CardChargeAttempt,
  CollectInvoiceCardPaymentDialog,
} from '../../src/components/CollectInvoiceCardPaymentDialog';

const mocks = vi.hoisted(() => ({
  listCards: vi.fn(),
  setup: vi.fn(),
  charge: vi.fn(),
  onClose: vi.fn(),
  onPaid: vi.fn(),
  onUnresolvedAttemptChange: vi.fn(),
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

// Holds the attempt like the invoice page does.
function DialogKeepingAttempt({
  balance,
  initialAttempt = null,
}: {
  balance: number;
  initialAttempt?: CardChargeAttempt | null;
}): ReactElement {
  const [attempt, setAttempt] = useState(initialAttempt);
  return (
    <CollectInvoiceCardPaymentDialog
      open
      onClose={mocks.onClose}
      onPaid={mocks.onPaid}
      invoice={{
        id: 'invoice-1',
        balance,
      }}
      unresolvedAttempt={attempt}
      onUnresolvedAttemptChange={(next) => {
        mocks.onUnresolvedAttemptChange(next);
        setAttempt(next);
      }}
    />
  );
}

const renderDialog = (
  balance = 320,
  initialAttempt: CardChargeAttempt | null = null
): ((nextBalance: number) => void) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  const dialog = (invoiceBalance: number): JSX.Element => (
    <QueryClientProvider client={queryClient}>
      <DialogKeepingAttempt balance={invoiceBalance} initialAttempt={initialAttempt} />
    </QueryClientProvider>
  );
  const { rerender } = render(dialog(balance));
  return (nextBalance) => rerender(dialog(nextBalance));
};

const chargeButton = (): HTMLElement =>
  within(screen.getByRole('dialog')).getByRole('button', {
    name: 'Charge card',
  });

const tryAgainButton = (): HTMLElement =>
  within(screen.getByRole('dialog')).getByRole('button', {
    name: 'Try again',
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

  it('charges the balance to the first saved card by default', async () => {
    const user = userEvent.setup();
    renderDialog();
    await screen.findByText(/4242/);
    const amount = screen.getByRole('textbox', { name: 'Amount *' });
    expect(amount).toHaveValue('320.00');

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

  it('opens on an unresolved attempt locked, and resends it unchanged', async () => {
    const user = userEvent.setup();
    renderDialog(320, {
      idempotencyKey: 'key-1',
      cardId: 'pm_2',
      amountInCents: 10000,
    });
    await screen.findByText(/1881/);

    const amount = screen.getByRole('textbox', { name: 'Amount *' });
    expect(amount).toHaveValue('100.00');
    expect(amount).toBeDisabled();
    await user.click(tryAgainButton());

    await waitFor(() => expect(mocks.onPaid).toHaveBeenCalled());
    expect(mocks.charge).toHaveBeenCalledWith(mocks.client, {
      invoiceId: 'invoice-1',
      amountInCents: 10000,
      paymentMethodId: 'pm_2',
      idempotencyKey: 'key-1',
    });
    expect(mocks.onUnresolvedAttemptChange).toHaveBeenLastCalledWith(null);
  });

  it('locks the amount and card while a charge is in flight', async () => {
    const user = userEvent.setup();
    mocks.charge.mockReturnValue(new Promise(() => {}));
    renderDialog();
    await screen.findByText(/4242/);

    await user.click(chargeButton());

    const amount = screen.getByRole('textbox', { name: 'Amount *' });
    const addCard = screen.getByRole('button', { name: 'Add card' });
    expect(amount).toBeDisabled();
    expect(addCard).toBeDisabled();
  });

  it('charges an amount under the balance', async () => {
    const user = userEvent.setup();
    renderDialog();
    await screen.findByText(/4242/);
    const amount = screen.getByRole('textbox', { name: 'Amount *' });

    await user.clear(amount);
    await user.type(amount, '120.50');
    await user.click(chargeButton());

    await waitFor(() => expect(mocks.charge).toHaveBeenCalled());
    expect(mocks.charge).toHaveBeenCalledWith(
      mocks.client,
      expect.objectContaining({
        amountInCents: 12050,
      })
    );
  });

  it('refuses an amount over the balance without charging', async () => {
    const user = userEvent.setup();
    renderDialog();
    await screen.findByText(/4242/);
    const amount = screen.getByRole('textbox', { name: 'Amount *' });

    await user.clear(amount);
    await user.type(amount, '320.01');
    await user.click(chargeButton());

    expect(await screen.findByText('Enter at most $320.00')).toBeInTheDocument();
    expect(mocks.charge).not.toHaveBeenCalled();
  });

  it('refuses an amount under the card minimum without charging', async () => {
    const user = userEvent.setup();
    renderDialog();
    await screen.findByText(/4242/);
    const amount = screen.getByRole('textbox', { name: 'Amount *' });

    await user.clear(amount);
    await user.type(amount, '0.49');
    await user.click(chargeButton());

    expect(await screen.findByText('Enter at least $0.50')).toBeInTheDocument();
    expect(mocks.charge).not.toHaveBeenCalled();
  });

  it('locks the amount and card after a failure that may have charged the card', async () => {
    const user = userEvent.setup();
    mocks.charge.mockRejectedValueOnce({
      code: APIErrorCode.BILLING_INVOICE_CONFLICT,
      message: 'A card payment on invoice INV-00042 is in progress. Try again in a few minutes.',
    });
    renderDialog();
    await screen.findByText(/4242/);

    await user.click(chargeButton());
    await screen.findByText('A card payment on invoice INV-00042 is in progress. Try again in a few minutes.');

    const amount = screen.getByRole('textbox', { name: 'Amount *' });
    const addCard = screen.getByRole('button', { name: 'Add card' });
    expect(amount).toBeDisabled();
    expect(addCard).toBeDisabled();
    await user.click(tryAgainButton());
    await waitFor(() => expect(mocks.onPaid).toHaveBeenCalled());
    const [[, first], [, second]] = mocks.charge.mock.calls;
    expect(second).toEqual(first);
  });

  it('unlocks the amount and card when a retried charge turns out declined', async () => {
    const user = userEvent.setup();
    mocks.charge.mockRejectedValueOnce(new Error('Network error')).mockRejectedValueOnce({
      code: APIErrorCode.STRIPE_PAYMENT_ERROR_SPECIFIC,
      message: 'Your card was declined.',
    });
    renderDialog();
    await screen.findByText(/4242/);

    await user.click(chargeButton());
    await screen.findByText('Network error');
    await user.click(tryAgainButton());
    await screen.findByText('Your card was declined.');

    const amount = screen.getByRole('textbox', { name: 'Amount *' });
    const addCard = screen.getByRole('button', { name: 'Add card' });
    expect(amount).toBeEnabled();
    expect(addCard).toBeEnabled();
    await user.clear(amount);
    await user.type(amount, '100');
    await user.click(chargeButton());
    await waitFor(() => expect(mocks.onPaid).toHaveBeenCalled());
    const [[, first], , [, third]] = mocks.charge.mock.calls;
    expect(third.amountInCents).toBe(10000);
    expect(third.idempotencyKey).not.toBe(first.idempotencyKey);
  });

  it('charges a changed amount under a new key after a declined charge', async () => {
    const user = userEvent.setup();
    mocks.charge.mockRejectedValueOnce({
      code: APIErrorCode.STRIPE_PAYMENT_ERROR_SPECIFIC,
      message: 'Your card was declined.',
    });
    renderDialog();
    await screen.findByText(/4242/);

    await user.click(chargeButton());
    await screen.findByText('Your card was declined.');
    const amount = screen.getByRole('textbox', { name: 'Amount *' });
    await user.clear(amount);
    await user.type(amount, '100');
    await user.click(chargeButton());

    await waitFor(() => expect(mocks.onPaid).toHaveBeenCalled());
    const [[, first], [, second]] = mocks.charge.mock.calls;
    expect(second.amountInCents).toBe(10000);
    expect(second.idempotencyKey).not.toBe(first.idempotencyKey);
  });

  it('resends a failed charge to the same card under the same key, and keeps the dialog open with the error', async () => {
    const user = userEvent.setup();
    mocks.charge.mockRejectedValueOnce(new Error('Network error'));
    renderDialog();
    await screen.findByText(/4242/);

    await user.click(chargeButton());

    expect(await screen.findByText('Network error')).toBeInTheDocument();
    expect(mocks.onClose).not.toHaveBeenCalled();
    await user.click(tryAgainButton());
    await waitFor(() => expect(mocks.onPaid).toHaveBeenCalled());
    const [[, first], [, second]] = mocks.charge.mock.calls;
    expect(second.idempotencyKey).toBe(first.idempotencyKey);
  });

  it('resends the amount it first charged after the balance reloads', async () => {
    const user = userEvent.setup();
    mocks.charge.mockRejectedValueOnce(new Error('Network error'));
    const setBalance = renderDialog();
    await screen.findByText(/4242/);

    await user.click(chargeButton());
    await screen.findByText('Network error');
    setBalance(0);
    await user.click(tryAgainButton());

    await waitFor(() => expect(mocks.onPaid).toHaveBeenCalled());
    const [, [, retry]] = mocks.charge.mock.calls;
    expect(retry.amountInCents).toBe(32000);
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
