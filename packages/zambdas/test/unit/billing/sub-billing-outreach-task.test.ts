import type { APIGatewayProxyResult } from 'aws-lambda';
import { Claim, Invoice, Task } from 'fhir/r4b';
import Stripe from 'stripe';
import { buildBillingInvoice, withInvoiceUncollectible, withStripeInvoiceLink } from 'utils/lib/fhir/billing-invoice';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { SEND_BILLING_OUTREACH_NOTIFICATION_ZAMBDA_KEY } from 'utils/lib/types/api/invoicing.types';
import { ChargeCardConfig } from 'utils/lib/types/api/scheduled-outreach.types';
import { BILLING_OUTREACH_TASK_CODE_SYSTEM } from 'utils/lib/types/data/billing/billing.constants';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ZambdaInput } from '../../../src/shared/types/common';
import { index } from '../../../src/subscriptions/task/sub-billing-outreach-task/index';

const { mockBillingClient, mockStripe } = vi.hoisted(() => ({
  mockBillingClient: { fhir: { search: vi.fn(), patch: vi.fn() }, zambda: { execute: vi.fn() } },
  mockStripe: { invoices: { retrieve: vi.fn(), pay: vi.fn() }, customers: { retrieve: vi.fn() } },
}));

vi.mock('utils/lib/ottehr-config/feature-flags', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    FEATURE_FLAGS_CONFIG: {
      ...(actual.FEATURE_FLAGS_CONFIG as Record<string, unknown>),
      ottehrBillingInvoicingEnabled: true,
      automatedPatientOutreachEnabled: true,
    },
  };
});
vi.mock('../../../src/shared/auth', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('mock-token'),
}));
vi.mock('../../../src/shared/sentry', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  wrapHandler: (_name: string, fn: (...args: unknown[]) => unknown) => fn,
}));
vi.mock('../../../src/billing/shared', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  createBillingClient: vi.fn(() => mockBillingClient),
}));
vi.mock('../../../src/shared/stripeIntegration', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getStripeClient: vi.fn(() => mockStripe as unknown as Stripe),
}));

const handler = index as (input: ZambdaInput) => Promise<APIGatewayProxyResult>;

const ENCOUNTER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const secrets = { BILLING_INTEGRATION: 'ottehr', INVOICING_IN_BILLING_APP: 'true' };

const baseInvoice = (): Invoice => ({
  ...withStripeInvoiceLink(
    buildBillingInvoice({
      status: 'issued',
      date: '2026-11-02T15:00:00.000Z',
      dueDate: '2026-11-30',
      recipient: { reference: 'Patient/billing-pat-1' },
      subject: { reference: 'Patient/billing-pat-1' },
      claims: [{ claimId: 'claim-1', amountCents: 9000 }],
    }),
    { stripeInvoiceId: 'in_1', stripeAccount: 'acct_1' }
  ),
  id: 'inv-1',
});
const claim: Claim = {
  resourceType: 'Claim',
  id: 'claim-1',
  identifier: [{ system: ottehrIdentifierSystem('claim-encounter-id'), value: ENCOUNTER_ID }],
} as Claim;

const chargeConfig: ChargeCardConfig = {
  retryAttempts: 1,
  retryIntervalDays: 2,
  onSuccess: { enabled: true, mediums: ['sms'], smsTemplate: 'Paid {{amount}}', emailTemplate: '' },
  onFailure: { enabled: true, mediums: ['email'], smsTemplate: '', emailTemplate: 'Charge failed' },
};

const makeTask = (code: string, input: Task['input'] = []): Task => ({
  resourceType: 'Task',
  id: 'task-1',
  meta: { versionId: '3' },
  status: 'requested',
  intent: 'order',
  code: { coding: [{ system: BILLING_OUTREACH_TASK_CODE_SYSTEM, code }] },
  for: { reference: 'Patient/billing-pat-1' },
  focus: { reference: 'Invoice/inv-1' },
  input,
});
const chargeTask = (): Task =>
  makeTask('charge-card', [{ type: { text: 'charge-card-config' }, valueString: JSON.stringify(chargeConfig) }]);
const notificationTask = (mediums: string): Task =>
  makeTask('send-notification', [
    { type: { text: 'mediums' }, valueString: mediums },
    { type: { text: 'sms-template' }, valueString: 'Pay {{amount}}' },
    { type: { text: 'email-template' }, valueString: 'Invoice ready' },
    { type: { text: 'statement-type' }, valueString: 'past-due' },
  ]);

let invoice: Invoice;
const stripeInvoice = (over: Partial<Stripe.Invoice> = {}): Stripe.Invoice =>
  ({
    id: 'in_1',
    status: 'open',
    customer: 'cus_1',
    amount_due: 9000,
    amount_remaining: 9000,
    hosted_invoice_url: 'https://pay.stripe/in_1',
    ...over,
  }) as Stripe.Invoice;

const run = async (task: Task): Promise<APIGatewayProxyResult> =>
  handler({ headers: null, body: JSON.stringify(task), secrets });

const finalStatus = (): unknown =>
  mockBillingClient.fhir.patch.mock.calls.at(-1)?.[0].operations.find((op: { path: string }) => op.path === '/status')
    ?.value;
const clinicalCalls = (): Record<string, unknown>[] =>
  mockBillingClient.zambda.execute.mock.calls.map(([input]) => input);

describe('sub-billing-outreach-task', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invoice = baseInvoice();
    mockBillingClient.fhir.search.mockImplementation(async ({ resourceType }: { resourceType: string }) => ({
      unbundle: () => (resourceType === 'Invoice' ? [invoice] : resourceType === 'Claim' ? [claim] : []),
    }));
    mockBillingClient.fhir.patch.mockResolvedValue({});
    mockBillingClient.zambda.execute.mockImplementation(async ({ mediums }: { mediums: string[] }) => ({
      output: { results: mediums.map((medium) => ({ medium, success: true })) },
    }));
    mockStripe.invoices.retrieve.mockResolvedValue(stripeInvoice());
    mockStripe.customers.retrieve.mockResolvedValue({ invoice_settings: { default_payment_method: 'pm_1' } });
    mockStripe.invoices.pay.mockResolvedValue({ status: 'paid', charge: 'ch_1' });
  });

  it.each([
    ['paid', (): Invoice => ({ ...baseInvoice(), status: 'balanced' })],
    ['uncollectible', (): Invoice => withInvoiceUncollectible(baseInvoice())],
  ])('cancels a %s invoice without asking Stripe', async (_label, makeInvoice) => {
    invoice = makeInvoice();

    const result = await run(chargeTask());

    expect(JSON.parse(result.body)).toEqual({ status: 'cancelled', reason: 'Invoice is no longer open' });
    expect(finalStatus()).toBe('cancelled');
    expect(mockStripe.invoices.retrieve).not.toHaveBeenCalled();
  });

  it('cancels when Stripe already settled the invoice, without paying or notifying', async () => {
    mockStripe.invoices.retrieve.mockResolvedValue(stripeInvoice({ status: 'paid' }));

    const result = await run(chargeTask());

    expect(JSON.parse(result.body)).toEqual({ status: 'cancelled', reason: 'Stripe invoice is paid' });
    expect(finalStatus()).toBe('cancelled');
    expect(mockStripe.invoices.pay).not.toHaveBeenCalled();
    expect(mockBillingClient.zambda.execute).not.toHaveBeenCalled();
  });

  it('charges on the connected account, completes, and sends the success notification', async () => {
    const result = await run(chargeTask());

    expect(JSON.parse(result.body).status).toBe('completed');
    expect(mockStripe.invoices.retrieve).toHaveBeenCalledWith('in_1', undefined, { stripeAccount: 'acct_1' });
    expect(mockStripe.invoices.pay).toHaveBeenCalledWith('in_1', { stripeAccount: 'acct_1' });
    expect(finalStatus()).toBe('completed');
    expect(clinicalCalls()).toEqual([
      {
        id: SEND_BILLING_OUTREACH_NOTIFICATION_ZAMBDA_KEY,
        encounterId: ENCOUNTER_ID,
        dueDate: '2026-11-30',
        mediums: ['sms'],
        smsTemplate: 'Paid {{amount}}',
        emailTemplate: '',
        statementType: undefined,
        chargeOutcome: true,
        amountCents: 9000,
        invoiceLink: 'https://pay.stripe/in_1',
      },
    ]);
  });

  it('still completes a successful charge when the notification call throws', async () => {
    mockBillingClient.zambda.execute.mockRejectedValue(new Error('clinical is down'));

    const result = await run(chargeTask());

    const body = JSON.parse(result.body);
    expect(body.status).toBe('completed');
    expect(body.notificationResults).toEqual([{ medium: 'sms', success: false, error: 'clinical is down' }]);
    expect(finalStatus()).toBe('completed');
  });

  it('sends a notification with the Stripe amount, hosted link, FHIR due date and templates', async () => {
    const result = await run(notificationTask('sms,email'));

    expect(JSON.parse(result.body).status).toBe('completed');
    expect(clinicalCalls()).toEqual([
      {
        id: SEND_BILLING_OUTREACH_NOTIFICATION_ZAMBDA_KEY,
        encounterId: ENCOUNTER_ID,
        dueDate: '2026-11-30',
        mediums: ['sms', 'email'],
        smsTemplate: 'Pay {{amount}}',
        emailTemplate: 'Invoice ready',
        statementType: 'past-due',
        amountCents: 9000,
        invoiceLink: 'https://pay.stripe/in_1',
      },
    ]);
    expect(finalStatus()).toBe('completed');
  });

  it('uses what is still owed on a partly paid invoice', async () => {
    mockStripe.invoices.retrieve.mockResolvedValue(stripeInvoice({ amount_due: 9000, amount_remaining: 4000 }));

    await run(notificationTask('sms'));
    const charged = JSON.parse((await run(chargeTask())).body);

    expect(clinicalCalls().map((call) => call.amountCents)).toEqual([4000, 4000]);
    expect(charged.chargeResult.amountCents).toBe(4000);
  });

  it('completes a log Task', async () => {
    const result = await run(makeTask('log'));

    expect(JSON.parse(result.body)).toEqual({ status: 'completed' });
    expect(finalStatus()).toBe('completed');
    expect(mockStripe.invoices.retrieve).not.toHaveBeenCalled();
  });
});
