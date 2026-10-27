import { render, screen, waitFor, within } from '@testing-library/react';
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
          { linkId: 'invoicing.defaultSmsTemplate', answer: [{ valueString: 'Pay {{amount}} at {{invoice-link}}' }] },
          { linkId: 'invoicing.defaultInvoiceMemo', answer: [{ valueString: 'Visit for {{patient-full-name}}' }] },
        ],
      },
    ],
  },
};

const recipient = (email?: string): GetBillingInvoiceRecipientResponse => ({
  patient: { fullName: 'Katie Test', dob: '05/04/2010', gender: 'Female', phoneNumber: '+12025550199' },
  responsibleParty: { fullName: 'Jane Test', email, phoneNumber: '+12025550101' },
  location: 'Downtown Clinic',
  visitDate: '07/01/2026',
});

const claim = { id: 'claim-1', claimBalance: 125.5 } as BillingClaimItem;

const sendButton = (): HTMLElement => screen.getByRole('button', { name: 'Send Invoice' });

function renderDialog(): { onSent: ReturnType<typeof vi.fn> } {
  const onSent = vi.fn();
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

    expect(await screen.findByText('Katie Test')).toBeVisible();
    expect(screen.getByText('Jane Test')).toBeVisible();
    expect(screen.getByText('jane@example.com')).toBeVisible();
    expect(mocks.getRecipient).toHaveBeenCalledWith(mocks.client, { claimId: 'claim-1' });
    expect(screen.getByRole('spinbutton', { name: 'Amount, $' })).toHaveValue(125.5);
    const dueDate = DateTime.now().plus({ days: 14 }).toISODate();
    expect(screen.getByRole('textbox', { name: 'Due date' })).toHaveValue(dueDate);

    await user.click(sendButton());

    await waitFor(() =>
      expect(mocks.create).toHaveBeenCalledWith(mocks.client, {
        claimId: 'claim-1',
        amountCents: 12550,
        dueDate,
        smsMessage: 'Pay {{amount}} at {{invoice-link}}',
        memo: 'Visit for {{patient-full-name}}',
        idempotencyKey: expect.any(String),
      })
    );
    expect(mocks.snackbar).toHaveBeenCalledWith('Invoice sent', { variant: 'success' });
    expect(onSent).toHaveBeenCalled();
  });

  it('previews the templates with the claim values', async () => {
    const user = userEvent.setup();
    renderDialog();

    const memo = await screen.findByRole('group', { name: 'Invoice memo' });
    await user.click(within(memo).getByRole('tab', { name: 'Preview' }));

    expect(within(memo).getByText('Visit for Katie Test')).toBeVisible();
    expect(within(memo).queryByText('Preview uses sample values.')).not.toBeInTheDocument();
  });

  it('warns when the invoice was emailed but the SMS was not sent', async () => {
    const user = userEvent.setup();
    mocks.create.mockResolvedValue({ invoiceId: 'inv-1', stripeInvoiceId: 'in_1', smsSent: false });
    const { onSent } = renderDialog();

    await user.click(await screen.findByRole('button', { name: 'Send Invoice' }));

    await waitFor(() =>
      expect(mocks.snackbar).toHaveBeenCalledWith('Invoice emailed, but the SMS could not be sent', {
        variant: 'warning',
      })
    );
    expect(onSent).toHaveBeenCalled();
  });

  it('blocks sending when the responsible party has no email', async () => {
    mocks.getRecipient.mockResolvedValue(recipient());
    renderDialog();

    expect(await screen.findByText("Doesn't have email")).toBeVisible();
    expect(
      screen.getByText('Invoice cannot be sent because the responsible party does not have an email address on file.')
    ).toBeVisible();
    expect(sendButton()).toBeDisabled();
  });

  it('shows the error and retries with the same idempotency key', async () => {
    const user = userEvent.setup();
    mocks.create.mockRejectedValueOnce(new Error('Stripe is unavailable'));
    const { onSent } = renderDialog();

    await user.click(await screen.findByRole('button', { name: 'Send Invoice' }));
    expect(await screen.findByText('Stripe is unavailable')).toBeVisible();
    expect(onSent).not.toHaveBeenCalled();

    await user.click(sendButton());

    await waitFor(() => expect(onSent).toHaveBeenCalled());
    const [first, second] = mocks.create.mock.calls.map(([, input]) => input.idempotencyKey);
    expect(second).toBe(first);
  });

  it('uses a new idempotency key when the amount changes after a failed attempt', async () => {
    const user = userEvent.setup();
    mocks.create.mockRejectedValueOnce(new Error('Stripe is unavailable'));
    renderDialog();

    await user.click(await screen.findByRole('button', { name: 'Send Invoice' }));
    expect(await screen.findByText('Stripe is unavailable')).toBeVisible();

    const amount = screen.getByRole('spinbutton', { name: 'Amount, $' });
    await user.clear(amount);
    await user.type(amount, '200');
    await user.click(sendButton());

    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(2));
    const [first, second] = mocks.create.mock.calls.map(([, input]) => input);
    expect(second.amountCents).toBe(20000);
    expect(second.idempotencyKey).not.toBe(first.idempotencyKey);
  });

  it('rejects an amount that is not positive', async () => {
    const user = userEvent.setup();
    renderDialog();

    const amount = await screen.findByRole('spinbutton', { name: 'Amount, $' });
    await user.clear(amount);
    await user.type(amount, '0');
    await user.click(sendButton());

    expect(await screen.findByText('Amount must be greater than 0')).toBeVisible();
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
