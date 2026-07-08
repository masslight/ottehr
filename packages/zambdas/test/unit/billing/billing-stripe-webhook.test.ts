import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Claim, PaymentNotice } from 'fhir/r4b';
import Stripe from 'stripe';
import { BILLING_RESOURCE_TAG, Secrets } from 'utils';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { afterEach, describe, expect, it, Mock, vi } from 'vitest';

vi.mock('../../../src/shared', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  wrapHandler: (_name: string, handler: unknown) => handler,
  checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('m2m-token'),
  getStripeClient: vi.fn(),
}));

vi.mock('../../../src/billing/shared', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  createBillingClient: vi.fn(),
}));

import { index, performEffect } from '../../../src/billing/billing-stripe-webhook';
import { validateRequestParameters } from '../../../src/billing/billing-stripe-webhook/validateRequestParameters';
import { createBillingClient } from '../../../src/billing/shared';
import {
  checkOrCreateM2MClientToken,
  getStripeClient,
  STRIPE_PAYMENT_ID_SYSTEM,
  ZambdaInput,
} from '../../../src/shared';

const WEBHOOK_SECRET = 'whsec_test_secret';
const CLAIM_ENC_SYSTEM = ottehrIdentifierSystem('claim-encounter-id');
const stripe = new Stripe('sk_test_123');

const secrets: Secrets = {
  BILLING_INTEGRATION: 'all',
  STRIPE_SECRET_KEY: 'sk_test_123',
  STRIPE_PUBLIC_KEY: 'pk_test_123',
  STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
  ORGANIZATION_ID: 'org-1',
  FHIR_API: 'https://fhir.example.com/r4',
  PROJECT_API: 'https://project.example.com/v1',
};

const makeCharge = (over: Record<string, unknown> = {}): Stripe.Charge =>
  ({
    id: 'ch_1',
    payment_intent: 'pi_1',
    amount: 1000,
    currency: 'usd',
    created: 1751900000,
    status: 'succeeded',
    paid: true,
    payment_method_details: { type: 'card' },
    metadata: { oystehr_encounter_id: 'enc-1' },
    ...over,
  }) as unknown as Stripe.Charge;

const makeEvent = (type: string, object: unknown, account?: string): Stripe.Event =>
  ({ id: 'evt_1', type, account, data: { object } }) as unknown as Stripe.Event;

const claim = {
  resourceType: 'Claim',
  id: 'claim-1',
  identifier: [{ system: CLAIM_ENC_SYSTEM, value: 'enc-1' }],
} as Claim;

const makeOystehr = (claimResults: Claim[][]): { oystehr: Oystehr; create: Mock; update: Mock } => {
  const claimQueue = [...claimResults];
  const search = vi.fn().mockImplementation(({ resourceType }: { resourceType: string }) => {
    const results = resourceType === 'Claim' ? claimQueue.shift() ?? [] : [];
    return Promise.resolve({ unbundle: () => results });
  });
  const create = vi
    .fn()
    .mockImplementation((resource: PaymentNotice) => Promise.resolve({ ...resource, id: 'pn-new' }));
  const update = vi.fn().mockResolvedValue({});
  const batch = vi.fn().mockResolvedValue({ entry: [] });
  return { oystehr: { fhir: { search, create, update, batch } } as unknown as Oystehr, create, update };
};

const signedInput = (event: Stripe.Event): ZambdaInput => {
  const payload = JSON.stringify(event);
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
  return { body: payload, headers: { 'Stripe-Signature': signature }, secrets };
};

afterEach(() => {
  vi.clearAllMocks();
});

describe('billing-stripe-webhook', () => {
  it('verifies the signature and returns the event', () => {
    (getStripeClient as Mock).mockReturnValue(stripe);
    const params = validateRequestParameters(signedInput(makeEvent('charge.succeeded', makeCharge())));
    expect(params.event.type).toBe('charge.succeeded');
  });

  it('rejects a body that does not match the signature', () => {
    (getStripeClient as Mock).mockReturnValue(stripe);
    const input = signedInput(makeEvent('charge.succeeded', makeCharge()));
    expect(() => validateRequestParameters({ ...input, body: '{"tampered":true}' })).toThrow();
  });

  it('acks without processing when BILLING_INTEGRATION does not include ottehr', async () => {
    (getStripeClient as Mock).mockReturnValue(stripe);
    const { oystehr, create } = makeOystehr([]);
    (createBillingClient as Mock).mockReturnValue(oystehr);
    const input = {
      ...signedInput(makeEvent('charge.succeeded', makeCharge())),
      secrets: { ...secrets, BILLING_INTEGRATION: 'candid' },
    };

    const result = await (index as unknown as (i: ZambdaInput) => Promise<APIGatewayProxyResult>)(input);

    expect(result.statusCode).toBe(200);
    expect(checkOrCreateM2MClientToken).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('conditionally creates a linked notice for a charge when the claim exists', async () => {
    const { oystehr, create, update } = makeOystehr([[claim]]);

    await performEffect(oystehr, { event: makeEvent('charge.succeeded', makeCharge()), secrets });

    const [resource, options] = create.mock.calls[0];
    expect(options.ifNoneExist).toEqual([
      { name: 'identifier', value: `${STRIPE_PAYMENT_ID_SYSTEM}|ch_1` },
      { name: '_tag', value: `${BILLING_RESOURCE_TAG.system}|${BILLING_RESOURCE_TAG.code}` },
    ]);
    expect(resource.request).toEqual({
      type: 'Claim',
      identifier: { system: CLAIM_ENC_SYSTEM, value: 'enc-1' },
      reference: 'Claim/claim-1',
    });
    expect(resource.identifier).toEqual([
      { system: STRIPE_PAYMENT_ID_SYSTEM, value: 'ch_1' },
      { system: STRIPE_PAYMENT_ID_SYSTEM, value: 'pi_1' },
    ]);
    expect(resource.amount).toEqual({ value: 10, currency: 'USD' });
    expect(update.mock.calls[0][0].request.reference).toBe('Claim/claim-1');
  });

  it('stores the notice with a logical reference when the claim does not exist yet', async () => {
    const { oystehr, create, update } = makeOystehr([[], []]);

    await performEffect(oystehr, { event: makeEvent('charge.succeeded', makeCharge()), secrets });

    expect(create.mock.calls[0][0].request).toEqual({
      type: 'Claim',
      identifier: { system: CLAIM_ENC_SYSTEM, value: 'enc-1' },
    });
    expect(update.mock.calls[0][0].request.reference).toBeUndefined();
  });

  it('keeps the existing link when the claim search misses on an update', async () => {
    const { oystehr, create, update } = makeOystehr([[], []]);
    create.mockResolvedValueOnce({
      resourceType: 'PaymentNotice',
      id: 'pn-1',
      request: { type: 'Claim', reference: 'Claim/previously-linked' },
    });

    await performEffect(oystehr, { event: makeEvent('charge.updated', makeCharge()), secrets });

    expect(update.mock.calls[0][0].id).toBe('pn-1');
    expect(update.mock.calls[0][0].request.reference).toBe('Claim/previously-linked');
  });

  it('records a refund as its own negative notice after upserting the charge notice', async () => {
    const retrieve = vi.fn().mockResolvedValue(makeCharge());
    (getStripeClient as Mock).mockReturnValue({ charges: { retrieve } } as unknown as Stripe);
    const { oystehr, create } = makeOystehr([[claim], [claim]]);
    const refund = {
      id: 're_1',
      charge: 'ch_1',
      amount: 400,
      currency: 'usd',
      created: 1751990000,
      status: 'succeeded',
    };

    await performEffect(oystehr, { event: makeEvent('refund.created', refund, 'acct_1'), secrets });

    expect(retrieve).toHaveBeenCalledWith('ch_1', undefined, { stripeAccount: 'acct_1' });
    expect(create.mock.calls[0][0].identifier).toContainEqual({ system: STRIPE_PAYMENT_ID_SYSTEM, value: 'ch_1' });
    const notice = create.mock.calls[1][0];
    expect(notice.identifier).toEqual([{ system: STRIPE_PAYMENT_ID_SYSTEM, value: 're_1' }]);
    expect(notice.amount).toEqual({ value: -4, currency: 'USD' });
    expect(notice.status).toBe('active');
    expect(notice.request.reference).toBe('Claim/claim-1');
  });

  it('cancels the notice for a failed refund', async () => {
    (getStripeClient as Mock).mockReturnValue({
      charges: { retrieve: vi.fn().mockResolvedValue(makeCharge()) },
    } as unknown as Stripe);
    const { oystehr, create } = makeOystehr([[claim], [claim]]);
    const refund = { id: 're_1', charge: 'ch_1', amount: 400, currency: 'usd', created: 1751990000, status: 'failed' };

    await performEffect(oystehr, { event: makeEvent('refund.failed', refund), secrets });

    const notice = create.mock.calls[1][0];
    expect(notice.status).toBe('cancelled');
    expect(notice.contained[0].outcome).toBe('error');
  });
});
