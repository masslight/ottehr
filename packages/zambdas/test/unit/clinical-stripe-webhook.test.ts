import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { PaymentNotice, Task } from 'fhir/r4b';
import Stripe from 'stripe';
import { RcmTaskCodings } from 'utils/lib/fhir/constants';
import { parsePaymentRefundsFromNotice } from 'utils/lib/fhir/paymentRefunds';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { index } from '../../src/ehr/clinical-stripe-webhook';
import { checkOrCreateM2MClientToken } from '../../src/shared/auth';
import { createClinicalOystehrClient } from '../../src/shared/helpers';
import { getStripeClient, STRIPE_PAYMENT_ID_SYSTEM } from '../../src/shared/stripeIntegration';
import { ZambdaInput } from '../../src/shared/types/common';

vi.mock('../../src/shared/sentry', () => ({ wrapHandler: (_name: string, handler: unknown) => handler }));
vi.mock('../../src/shared/auth', () => ({ checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('token') }));
vi.mock('../../src/shared/helpers', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  createClinicalOystehrClient: vi.fn(),
}));
vi.mock('../../src/shared/stripeIntegration', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getStripeClient: vi.fn(),
}));

const stripe = new Stripe('sk_test_123');
const list = vi.fn();
const search = vi.fn();
const patch = vi.fn();
const accountSecrets = [{ accountId: 'acct_1', signingSecret: 'whsec_1' }];
let notice: PaymentNotice;
let refund: Stripe.Refund;

const invoke = (
  type = 'refund.created',
  object: unknown = refund,
  signingSecret = 'whsec_1',
  account?: string
): Promise<APIGatewayProxyResult> => {
  const body = JSON.stringify({ id: 'evt_1', type, account, data: { object } });
  return (index as (input: ZambdaInput) => Promise<APIGatewayProxyResult>)({
    body,
    headers: { 'Stripe-Signature': stripe.webhooks.generateTestHeaderString({ payload: body, secret: signingSecret }) },
    secrets: {
      BILLING_INTEGRATION: 'candid',
      STRIPE_WEBHOOK_SECRET: 'whsec_billing',
      STRIPE_CLINICAL_WEBHOOK_SECRET: JSON.stringify(accountSecrets),
    },
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  notice = { resourceType: 'PaymentNotice', id: 'pn-clinical', status: 'active' } as PaymentNotice;
  refund = {
    id: 're_1',
    payment_intent: 'pi_1',
    charge: 'ch_1',
    amount: 400,
    created: 1751990000,
    status: 'succeeded',
  } as Stripe.Refund;
  list.mockReturnValue({
    async *[Symbol.asyncIterator]() {
      yield refund;
    },
  });
  search.mockResolvedValue({ unbundle: () => [notice] });
  patch.mockImplementation(async ({ operations }) => {
    notice.extension = operations[0].value;
  });
  vi.mocked(getStripeClient).mockReturnValue({
    webhooks: stripe.webhooks,
    refunds: { list },
  } as unknown as Stripe);
  vi.mocked(createClinicalOystehrClient).mockReturnValue({ fhir: { search, patch } } as unknown as Oystehr);
});

describe('clinical-stripe-webhook', () => {
  it.each([
    ['invoice.paid', 'paid'],
    ['invoice.voided', 'void'],
    ['invoice.marked_uncollectible', 'uncollectible'],
  ])('updates %s once for a recorded invoice ID', async (type, status) => {
    const task: Task = {
      resourceType: 'Task',
      id: 'task-1',
      status: 'completed',
      intent: 'order',
      output: [
        { type: RcmTaskCodings.sendInvoiceOutputInvoiceId, valueString: 'in_1' },
        { type: RcmTaskCodings.sendInvoiceOutputInvoiceId, valueString: 'in_2' },
      ],
    };
    const invoice = { id: 'in_1', metadata: { oystehr_encounter_id: 'enc-1' } };
    search.mockResolvedValue({ unbundle: () => [task] });
    patch.mockImplementation(async ({ operations }) => {
      task.output = operations[0].value;
    });

    await invoke(type, invoice);
    expect(task.output).toContainEqual({ type: RcmTaskCodings.stripeInvoiceStatus, valueString: status });
    await invoke(type, invoice);
    expect(patch).toHaveBeenCalledTimes(1);
  });

  it.each(['refund.created', 'refund.updated', 'refund.failed'])(
    'syncs %s for the configured account without Ottehr Billing',
    async (type) => {
      if (type === 'refund.failed') refund.status = 'failed';
      expect((await invoke(type)).statusCode).toBe(200);
      expect(list).toHaveBeenCalledWith({ payment_intent: 'pi_1', limit: 100 }, { stripeAccount: 'acct_1' });
      expect(search).toHaveBeenCalledWith({
        resourceType: 'PaymentNotice',
        params: [{ name: 'identifier', value: `${STRIPE_PAYMENT_ID_SYSTEM}|pi_1` }],
      });
      expect(parsePaymentRefundsFromNotice(notice)).toMatchObject([
        { stripeRefundId: 're_1', amountInCents: 400, status: refund.status },
      ]);
      await invoke(type);
      expect(patch).toHaveBeenCalledTimes(1);
    }
  );

  it.each([
    ['whsec_billing', undefined],
    ['whsec_1', 'acct_2'],
  ])('rejects an unrelated signature or account: %s / %s', async (signingSecret, account) => {
    await expect(invoke('refund.created', refund, signingSecret, account)).rejects.toMatchObject({
      code: INVALID_INPUT_ERROR('').code,
    });
    expect(checkOrCreateM2MClientToken).not.toHaveBeenCalled();
    expect(search).not.toHaveBeenCalled();
  });

  it('ignores unrelated events and payments with no clinical notice', async () => {
    expect((await invoke('charge.succeeded')).statusCode).toBe(200);
    expect(search).not.toHaveBeenCalled();
    search.mockResolvedValueOnce({ unbundle: () => [] });
    expect((await invoke()).statusCode).toBe(200);
    expect(list).not.toHaveBeenCalled();
    expect(patch).not.toHaveBeenCalled();
  });

  it('passes failed FHIR writes to the existing handler error handling', async () => {
    const failure = new Error('FHIR unavailable');
    patch.mockRejectedValueOnce(failure);
    await expect(invoke()).rejects.toBe(failure);
  });
});
