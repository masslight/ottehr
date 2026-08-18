import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Claim, Organization, PaymentNotice } from 'fhir/r4b';
import Stripe from 'stripe';
import { BILLING_RESOURCE_TAG } from 'utils/lib/fhir/constants';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { Secrets } from 'utils/lib/secrets';
import { INVALID_INPUT_ERROR, MISCONFIGURED_ENVIRONMENT_ERROR } from 'utils/lib/types/errors';
import { afterEach, describe, expect, it, Mock, vi } from 'vitest';

vi.mock('../../../src/shared/sentry', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  wrapHandler: (_name: string, handler: unknown) => handler,
}));

vi.mock('../../../src/shared/auth', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('m2m-token'),
}));

vi.mock('../../../src/shared/stripeIntegration', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getStripeClient: vi.fn(),
}));

vi.mock('../../../src/billing/shared', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  createBillingClient: vi.fn(),
}));

import { index, performEffect } from '../../../src/billing/billing-stripe-webhook';
import { validateRequestParameters } from '../../../src/billing/billing-stripe-webhook/validateRequestParameters';
import { createBillingClient } from '../../../src/billing/shared';
import { checkOrCreateM2MClientToken } from '../../../src/shared/auth';
import { getStripeClient, STRIPE_PAYMENT_ID_SYSTEM } from '../../../src/shared/stripeIntegration';
import { ZambdaInput } from '../../../src/shared/types/common';

const WEBHOOK_SECRET = 'whsec_test_secret';
const PLATFORM_WEBHOOK_SECRET = 'whsec_platform_test_secret';
const CLAIM_ENC_SYSTEM = ottehrIdentifierSystem('claim-encounter-id');
const stripe = new Stripe('sk_test_123');

const secrets: Secrets = {
  BILLING_INTEGRATION: 'all',
  STRIPE_SECRET_KEY: 'sk_test_123',
  STRIPE_PUBLIC_KEY: 'pk_test_123',
  STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
  STRIPE_PLATFORM_WEBHOOK_SECRET: PLATFORM_WEBHOOK_SECRET,
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

const makeInvoice = (over: Record<string, unknown> = {}): Stripe.Invoice =>
  ({
    id: 'in_1',
    charge: null,
    amount_paid: 9000,
    currency: 'usd',
    created: 1751900000,
    status: 'paid',
    paid: true,
    paid_out_of_band: false,
    status_transitions: {
      paid_at: 1751900500,
    },
    metadata: {
      oystehr_encounter_id: 'enc-1',
    },
    ...over,
  }) as unknown as Stripe.Invoice;

const stripeError = (over: Record<string, unknown>): Error => Object.assign(new Error('stripe'), over);

const makeEvent = (type: string, object: unknown, account?: string): Stripe.Event =>
  ({ id: 'evt_1', type, account, data: { object } }) as unknown as Stripe.Event;

const claim = {
  resourceType: 'Claim',
  id: 'claim-1',
  identifier: [{ system: CLAIM_ENC_SYSTEM, value: 'enc-1' }],
} as Claim;

const makeOystehr = (
  claimResults: Claim[][],
  orgResults: Organization[][] = []
): { oystehr: Oystehr; create: Mock; update: Mock } => {
  const claimQueue = [...claimResults];
  const orgQueue = [...orgResults];
  const search = vi.fn().mockImplementation(({ resourceType }: { resourceType: string }) => {
    const results =
      resourceType === 'Claim'
        ? claimQueue.shift() ?? []
        : resourceType === 'Organization'
        ? orgQueue.shift() ?? []
        : [];
    return Promise.resolve({ unbundle: () => results });
  });
  const create = vi
    .fn()
    .mockImplementation((resource: PaymentNotice) => Promise.resolve({ ...resource, id: 'pn-new' }));
  const update = vi.fn().mockResolvedValue({});
  const batch = vi.fn().mockResolvedValue({ entry: [] });
  return { oystehr: { fhir: { search, create, update, batch } } as unknown as Oystehr, create, update };
};

const signedInput = (event: Stripe.Event, webhookSecret = WEBHOOK_SECRET): ZambdaInput => {
  const payload = JSON.stringify(event);
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: webhookSecret });
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

  it('verifies a platform destination signature with its separate secret', () => {
    (getStripeClient as Mock).mockReturnValue(stripe);
    const params = validateRequestParameters(
      signedInput(makeEvent('charge.succeeded', makeCharge()), PLATFORM_WEBHOOK_SECRET)
    );
    expect(params.event.type).toBe('charge.succeeded');
  });

  it('keeps working when the optional platform destination secret is not configured', () => {
    (getStripeClient as Mock).mockReturnValue(stripe);
    const input = signedInput(makeEvent('charge.succeeded', makeCharge()));
    const { STRIPE_PLATFORM_WEBHOOK_SECRET: _, ...secretsWithoutPlatformWebhook } = input.secrets!;

    const params = validateRequestParameters({ ...input, secrets: secretsWithoutPlatformWebhook });

    expect(params.event.type).toBe('charge.succeeded');
  });

  it('works when only the platform destination secret is configured', () => {
    (getStripeClient as Mock).mockReturnValue(stripe);
    const input = signedInput(makeEvent('charge.succeeded', makeCharge()), PLATFORM_WEBHOOK_SECRET);
    const { STRIPE_WEBHOOK_SECRET: _, ...secretsWithoutConnectedWebhook } = input.secrets!;

    const params = validateRequestParameters({ ...input, secrets: secretsWithoutConnectedWebhook });

    expect(params.event.type).toBe('charge.succeeded');
  });

  it('rejects requests when no webhook signing secret is configured', () => {
    (getStripeClient as Mock).mockReturnValue(stripe);
    const input = signedInput(makeEvent('charge.succeeded', makeCharge()));
    const secretsWithoutWebhooks = { ...input.secrets };
    delete secretsWithoutWebhooks.STRIPE_WEBHOOK_SECRET;
    delete secretsWithoutWebhooks.STRIPE_PLATFORM_WEBHOOK_SECRET;

    expect(() => validateRequestParameters({ ...input, secrets: secretsWithoutWebhooks })).toThrow(
      expect.objectContaining(
        MISCONFIGURED_ENVIRONMENT_ERROR(
          'Neither "STRIPE_WEBHOOK_SECRET" nor "STRIPE_PLATFORM_WEBHOOK_SECRET" was set. Please ensure at least one is configured in project secrets.'
        )
      )
    );
  });

  it('rejects a body that does not match the signature', () => {
    (getStripeClient as Mock).mockReturnValue(stripe);
    const input = signedInput(makeEvent('charge.succeeded', makeCharge()));
    expect(() => validateRequestParameters({ ...input, body: '{"tampered":true}' })).toThrow(
      expect.objectContaining(INVALID_INPUT_ERROR('Invalid Stripe webhook signature'))
    );
  });

  it('rejects a missing signature as invalid input', () => {
    (getStripeClient as Mock).mockReturnValue(stripe);
    const input = signedInput(makeEvent('charge.succeeded', makeCharge()));

    expect(() => validateRequestParameters({ ...input, headers: {} })).toThrow(
      expect.objectContaining(INVALID_INPUT_ERROR('Missing Stripe-Signature header'))
    );
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

  it('puts the resolved billing provider in payee and recipient', async () => {
    const bp = { resourceType: 'Organization', id: 'bp-1' } as Organization;
    const { oystehr, create } = makeOystehr([[claim]], [[bp]]);

    await performEffect(oystehr, { event: makeEvent('charge.succeeded', makeCharge(), 'acct_1'), secrets });

    expect(create.mock.calls[0][0].payee).toEqual({ reference: 'Organization/bp-1' });
    expect(create.mock.calls[0][0].recipient).toEqual({ reference: 'Organization/bp-1' });
  });

  it('falls back to the default org when no provider carries the account', async () => {
    const { oystehr, create } = makeOystehr([[claim]]);

    await performEffect(oystehr, { event: makeEvent('charge.succeeded', makeCharge(), 'acct_1'), secrets });

    expect(create.mock.calls[0][0].payee).toEqual({ reference: 'Organization/org-1' });
  });

  it('picks the first provider when several share the account', async () => {
    const bps = [
      { resourceType: 'Organization', id: 'bp-1' },
      { resourceType: 'Organization', id: 'bp-2' },
    ] as Organization[];
    const { oystehr, create } = makeOystehr([[claim]], [bps]);

    await performEffect(oystehr, { event: makeEvent('charge.succeeded', makeCharge(), 'acct_1'), secrets });

    expect(create.mock.calls[0][0].payee).toEqual({ reference: 'Organization/bp-1' });
  });

  it('throws when multiple claims carry the encounter identifier', async () => {
    const { oystehr, create } = makeOystehr([[claim, { ...claim, id: 'claim-2' }]]);

    await expect(
      performEffect(oystehr, { event: makeEvent('charge.succeeded', makeCharge()), secrets })
    ).rejects.toThrow('cannot pick one safely');
    expect(create).not.toHaveBeenCalled();
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

    expect(retrieve).toHaveBeenCalledWith('ch_1', { expand: ['invoice'] }, { stripeAccount: 'acct_1' });
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

describe('billing-stripe-webhook invoice-originated charges', () => {
  it('resolves the encounter from the invoice when the charge carries no metadata', async () => {
    const retrieve = vi.fn().mockResolvedValue(makeInvoice());
    (getStripeClient as Mock).mockReturnValue({
      invoices: {
        retrieve,
      },
    } as unknown as Stripe);
    const { oystehr, create } = makeOystehr([[claim]]);
    const charge = makeCharge({
      metadata: {},
      invoice: 'in_1',
    });

    await performEffect(oystehr, {
      event: makeEvent('charge.succeeded', charge, 'acct_1'),
      secrets,
    });

    expect(retrieve).toHaveBeenCalledWith('in_1', undefined, { stripeAccount: 'acct_1' });
    const notice = create.mock.calls[0][0];
    expect(notice.request.identifier).toEqual({
      system: CLAIM_ENC_SYSTEM,
      value: 'enc-1',
    });
    expect(notice.request.reference).toBe('Claim/claim-1');
    expect(notice.identifier).toContainEqual({
      system: STRIPE_PAYMENT_ID_SYSTEM,
      value: 'ch_1',
    });
    expect(notice.contained[0].disposition).toContain('for invoice in_1');
  });

  it('prefers the charge metadata and skips the invoice lookup entirely', async () => {
    const retrieve = vi.fn();
    (getStripeClient as Mock).mockReturnValue({
      invoices: {
        retrieve,
      },
    } as unknown as Stripe);
    const { oystehr, create } = makeOystehr([[claim]]);
    const charge = makeCharge({ invoice: 'in_1' });

    await performEffect(oystehr, { event: makeEvent('charge.succeeded', charge), secrets });

    expect(retrieve).not.toHaveBeenCalled();
    expect(create.mock.calls[0][0].request.identifier.value).toBe('enc-1');
  });

  it('reads an already expanded invoice without re-fetching it', async () => {
    const retrieve = vi.fn();
    (getStripeClient as Mock).mockReturnValue({
      invoices: {
        retrieve,
      },
    } as unknown as Stripe);
    const { oystehr, create } = makeOystehr([[claim]]);
    const charge = makeCharge({
      metadata: {},
      invoice: makeInvoice(),
    });

    await performEffect(oystehr, {
      event: makeEvent('charge.succeeded', charge),
      secrets,
    });

    expect(retrieve).not.toHaveBeenCalled();
    expect(create.mock.calls[0][0].request.identifier.value).toBe('enc-1');
  });

  it('skips the upsert when the invoice carries no encounter metadata either', async () => {
    const retrieve = vi.fn().mockResolvedValue(makeInvoice({ metadata: {} }));
    (getStripeClient as Mock).mockReturnValue({
      invoices: {
        retrieve,
      },
    } as unknown as Stripe);
    const { oystehr, create } = makeOystehr([[claim]]);
    const charge = makeCharge({
      metadata: {},
      invoice: 'in_1',
    });

    await performEffect(oystehr, { event: makeEvent('charge.succeeded', charge), secrets });

    expect(create).not.toHaveBeenCalled();
  });

  it('skips the upsert when the invoice no longer exists', async () => {
    const retrieve = vi.fn().mockRejectedValue(stripeError({ code: 'resource_missing' }));
    (getStripeClient as Mock).mockReturnValue({
      invoices: {
        retrieve,
      },
    } as unknown as Stripe);
    const { oystehr, create } = makeOystehr([[claim]]);
    const charge = makeCharge({
      metadata: {},
      invoice: 'in_1',
    });

    await performEffect(oystehr, { event: makeEvent('charge.succeeded', charge), secrets });

    expect(create).not.toHaveBeenCalled();
  });

  it('rethrows a transient stripe failure so stripe redelivers the event', async () => {
    const retrieve = vi.fn().mockRejectedValue(stripeError({ type: 'StripeAPIError', statusCode: 503 }));
    (getStripeClient as Mock).mockReturnValue({
      invoices: {
        retrieve,
      },
    } as unknown as Stripe);
    const { oystehr, create } = makeOystehr([[claim]]);
    const charge = makeCharge({
      metadata: {},
      invoice: 'in_1',
    });

    await expect(performEffect(oystehr, { event: makeEvent('charge.succeeded', charge), secrets })).rejects.toThrow(
      'stripe'
    );
    expect(create).not.toHaveBeenCalled();
  });

  it('skips a charge with neither metadata nor an invoice without calling stripe', async () => {
    const retrieve = vi.fn();
    (getStripeClient as Mock).mockReturnValue({
      invoices: {
        retrieve,
      },
    } as unknown as Stripe);
    const { oystehr, create } = makeOystehr([[claim]]);
    const charge = makeCharge({
      metadata: {},
      invoice: null,
    });

    await performEffect(oystehr, { event: makeEvent('charge.succeeded', charge), secrets });

    expect(retrieve).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('resolves a refund through the invoice expanded on its charge', async () => {
    const chargeRetrieve = vi.fn().mockResolvedValue(
      makeCharge({
        metadata: {},
        invoice: makeInvoice(),
      })
    );
    const invoiceRetrieve = vi.fn();
    (getStripeClient as Mock).mockReturnValue({
      charges: {
        retrieve: chargeRetrieve,
      },
      invoices: {
        retrieve: invoiceRetrieve,
      },
    } as unknown as Stripe);
    const { oystehr, create } = makeOystehr([[claim], [claim]]);
    const refund = {
      id: 're_1',
      charge: 'ch_1',
      amount: 400,
      currency: 'usd',
      created: 1751990000,
      status: 'succeeded',
    };

    await performEffect(oystehr, { event: makeEvent('refund.created', refund), secrets });

    expect(invoiceRetrieve).not.toHaveBeenCalled();
    expect(create.mock.calls[0][0].request.identifier.value).toBe('enc-1');
    expect(create.mock.calls[1][0].request.identifier.value).toBe('enc-1');
  });
});

// An invoice can settle with no charge: marked paid out of band, or covered by customer credit.
describe('billing-stripe-webhook chargeless invoices', () => {
  it('records a notice for an invoice marked paid out of band', async () => {
    const { oystehr, create } = makeOystehr([[claim]]);
    const invoice = makeInvoice({ paid_out_of_band: true });

    await performEffect(oystehr, {
      event: makeEvent('invoice.paid', invoice),
      secrets,
    });

    const [resource, options] = create.mock.calls[0];
    expect(options.ifNoneExist).toContainEqual({
      name: 'identifier',
      value: `${STRIPE_PAYMENT_ID_SYSTEM}|in_1`,
    });
    expect(resource.identifier).toEqual([
      {
        system: STRIPE_PAYMENT_ID_SYSTEM,
        value: 'in_1',
      },
    ]);
    expect(resource.amount).toEqual({
      value: 90,
      currency: 'USD',
    });
    expect(resource.status).toBe('active');
    expect(resource.request.reference).toBe('Claim/claim-1');
    expect(resource.extension[0].valueString).toBe('other');
    expect(resource.contained[0].disposition).toContain('marked paid out of band');
    // paid_at, not the invoice creation time
    expect(resource.created).toBe(new Date(1751900500 * 1000).toISOString());
  });

  it('records a credit balance settlement when the invoice was not paid out of band', async () => {
    const { oystehr, create } = makeOystehr([[claim]]);

    await performEffect(oystehr, {
      event: makeEvent('invoice.paid', makeInvoice()),
      secrets,
    });

    expect(create.mock.calls[0][0].contained[0].disposition).toContain('paid from credit balance');
  });

  it('ignores an invoice that a charge settled, since the charge event records it', async () => {
    const { oystehr, create } = makeOystehr([[claim]]);
    const invoice = makeInvoice({ charge: 'ch_1' });

    await performEffect(oystehr, {
      event: makeEvent('invoice.paid', invoice),
      secrets,
    });

    expect(create).not.toHaveBeenCalled();
  });

  it('ignores an invoice with no encounter metadata', async () => {
    const { oystehr, create } = makeOystehr([[claim]]);
    const invoice = makeInvoice({ metadata: {} });

    await performEffect(oystehr, {
      event: makeEvent('invoice.paid', invoice),
      secrets,
    });

    expect(create).not.toHaveBeenCalled();
  });

  it('ignores an invoice that settled for nothing', async () => {
    const { oystehr, create } = makeOystehr([[claim]]);
    const invoice = makeInvoice({ amount_paid: 0 });

    await performEffect(oystehr, {
      event: makeEvent('invoice.paid', invoice),
      secrets,
    });

    expect(create).not.toHaveBeenCalled();
  });
});
