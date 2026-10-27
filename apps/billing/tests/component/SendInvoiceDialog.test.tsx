import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DateTime } from 'luxon';
import { InvoiceConfigResponse } from 'utils/lib/types/api/invoice-config.types';
import { BillingClaimItem, GetBillingInvoiceRecipientResponse } from 'utils/lib/types/data/billing/billing.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SendInvoiceDialog } from '../../src/components/SendInvoiceDialog';

const mocks = vi.hoisted(() => ({
  getConfig: vi.fn(),
  getRecipient: vi.fn(),
  create: vi.fn(),
  snackbar: vi.fn(),
  client: {},
}));
vi.mock('../../src/api/api', () => ({
  getInvoiceConfig: mocks.getConfig,
  getBillingInvoiceRecipient: mocks.getRecipient,
  createBillingInvoice: mocks.create,
}));
vi.mock('../../src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehrZambda: mocks.client }) }));
vi.mock('notistack', () => ({ enqueueSnackbar: mocks.snackbar }));
vi.mock('../../src/components/DateInput', async () => ({ DateInput: (await import('./inputStub')).InputStub }));

const config: InvoiceConfigResponse = {
  questionnaire: { resourceType: 'Questionnaire', status: 'active' },
  questionnaireResponse: {
    resourceType: 'QuestionnaireResponse',
    status: 'completed',
    item: [
      {
        linkId: 'invoicing',
        item: [
          { linkId: 'invoicing.dueDaysFromGeneration', answer: [{ valueInteger: 14 }] },
          { linkId: 'invoicing.defaultSmsTemplate', answer: [{ valueString: 'Pay {{amount}}' }] },
          { linkId: 'invoicing.defaultInvoiceMemo', answer: [{ valueString: 'Visit for {{patient-full-name}}' }] },
        ],
      },
    ],
  },
};

const recipient = (email?: string): GetBillingInvoiceRecipientResponse => ({
  patient: { fullName: 'Katie Test', dob: '05/04/2010', gender: 'Female', phoneNumber: '+12025550199' },
  responsibleParty: { fullName: 'Jane Test', email, phoneNumber: '+12025550101' },
});

const sendButton = (): Promise<HTMLElement> => screen.findByRole('button', { name: 'Send Invoice' });

function renderDialog(): { onSent: ReturnType<typeof vi.fn> } {
  const onSent = vi.fn();
  const claim = { id: 'claim-1', claimBalance: 125.5 } as BillingClaimItem;
  render(<SendInvoiceDialog claim={claim} onClose={vi.fn()} onSent={onSent} />);
  return { onSent };
}

describe('Send Invoice dialog', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getConfig.mockResolvedValue(config);
    mocks.getRecipient.mockResolvedValue(recipient('jane@example.com'));
    mocks.create.mockResolvedValue({ invoiceId: 'inv-1', stripeInvoiceId: 'in_1', smsSent: true });
  });

  it('prefills the claim balance and configured templates and sends the invoice', async () => {
    const user = userEvent.setup();
    const { onSent } = renderDialog();

    expect(await screen.findByText('jane@example.com')).toBeVisible();
    await user.click(await sendButton());

    await waitFor(() =>
      expect(mocks.create).toHaveBeenCalledWith(mocks.client, {
        claimId: 'claim-1',
        amountCents: 12550,
        dueDate: DateTime.now().plus({ days: 14 }).toISODate(),
        smsMessage: 'Pay {{amount}}',
        memo: 'Visit for {{patient-full-name}}',
        idempotencyKey: expect.any(String),
      })
    );
    expect(mocks.snackbar).toHaveBeenCalledWith('Invoice sent', { variant: 'success' });
    expect(onSent).toHaveBeenCalled();
  });

  it('blocks sending when the responsible party has no email', async () => {
    mocks.getRecipient.mockResolvedValue(recipient());
    renderDialog();

    expect(await screen.findByText("Doesn't have email")).toBeVisible();
    expect(await sendButton()).toBeDisabled();
  });

  it('retries with the same key, uses a new key for a new amount, and warns when the SMS failed', async () => {
    const user = userEvent.setup();
    mocks.create
      .mockRejectedValueOnce(new Error('Stripe is unavailable'))
      .mockRejectedValueOnce(new Error('Stripe is unavailable'))
      .mockResolvedValueOnce({ invoiceId: 'inv-1', stripeInvoiceId: 'in_1', smsSent: false });
    const { onSent } = renderDialog();

    await user.click(await sendButton());
    expect(await screen.findByText('Stripe is unavailable')).toBeVisible();
    await user.click(await sendButton());
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(2));
    const amount = screen.getByRole('spinbutton', { name: 'Amount, $' });
    await user.clear(amount);
    await user.type(amount, '200');
    await user.click(await sendButton());

    await waitFor(() => expect(onSent).toHaveBeenCalled());
    const [first, retry, changed] = mocks.create.mock.calls.map(([, input]) => input.idempotencyKey);
    expect(retry).toBe(first);
    expect(changed).not.toBe(first);
    expect(mocks.snackbar).toHaveBeenCalledWith('Invoice emailed, but the SMS could not be sent', {
      variant: 'warning',
    });
  });
});
