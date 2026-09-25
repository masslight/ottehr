import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { PaymentNotice } from 'fhir/r4b';
import Stripe from 'stripe';
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
const retrieve = vi.fn();
const list = vi.fn();
const search = vi.fn();
const patch = vi.fn();
const accountSecrets = Array.from({ length: 10 }, (_, i) => ({
  accountId: `acct_${i + 1}`,
  signingSecret: `whsec_${i + 1}`,
}));
let notice: PaymentNotice;
let refund: Stripe.Refund;

const invoke = (
  type = 'refund.created',
  signingSecret = 'whsec_10',
  account?: string
): Promise<APIGatewayProxyResult> => {
  const body = JSON.stringify({ id: 'evt_1', type, account, data: { object: refund } });
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
  refund = { id: 're_1', charge: 'ch_1', amount: 400, created: 1751990000, status: 'succeeded' } as Stripe.Refund;
  retrieve.mockResolvedValue({ id: 'ch_1', payment_intent: 'pi_1' });
  list.mockReturnValue([refund]);
  search.mockResolvedValue({ unbundle: () => [notice] });
  patch.mockImplementation(async ({ operations }) => {
    notice.extension = operations[0].value;
  });
  vi.mocked(getStripeClient).mockReturnValue({
    webhooks: stripe.webhooks,
    charges: { retrieve },
    refunds: { list },
  } as unknown as Stripe);
  vi.mocked(createClinicalOystehrClient).mockReturnValue({ fhir: { search, patch } } as unknown as Oystehr);
});

describe('clinical-stripe-webhook', () => {
  it.each(['refund.created', 'refund.updated', 'refund.failed'])(
    'syncs %s for the last configured account without Ottehr Billing',
    async (type) => {
      if (type === 'refund.failed') refund.status = 'failed';
      expect((await invoke(type)).statusCode).toBe(200);
      expect(retrieve).toHaveBeenCalledWith('ch_1', undefined, { stripeAccount: 'acct_10' });
      expect(list).toHaveBeenCalledWith({ charge: 'ch_1', limit: 100 }, { stripeAccount: 'acct_10' });
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
    ['whsec_10', 'acct_2'],
  ])('rejects an unrelated signature or account: %s / %s', async (signingSecret, account) => {
    await expect(invoke('refund.created', signingSecret, account)).rejects.toMatchObject({
      code: INVALID_INPUT_ERROR('').code,
    });
    expect(checkOrCreateM2MClientToken).not.toHaveBeenCalled();
    expect(retrieve).not.toHaveBeenCalled();
  });

  it('ignores unrelated events and payments with no clinical notice', async () => {
    expect((await invoke('charge.succeeded')).statusCode).toBe(200);
    expect(retrieve).not.toHaveBeenCalled();
    search.mockResolvedValueOnce({ unbundle: () => [] });
    expect((await invoke()).statusCode).toBe(200);
    expect(list).not.toHaveBeenCalled();
    expect(patch).not.toHaveBeenCalled();
  });

  it('reads the complete refund iterator', async () => {
    const refunds = Array.from({ length: 101 }, (_, i) => ({ ...refund, id: `re_${i + 1}` }));
    list.mockReturnValue({
      async *[Symbol.asyncIterator]() {
        yield* refunds;
      },
    });
    await invoke();
    expect(parsePaymentRefundsFromNotice(notice)).toHaveLength(101);
  });

  it('passes failed FHIR writes to the existing handler error handling', async () => {
    const failure = new Error('FHIR unavailable');
    patch.mockRejectedValueOnce(failure);
    await expect(invoke()).rejects.toBe(failure);
  });
});
