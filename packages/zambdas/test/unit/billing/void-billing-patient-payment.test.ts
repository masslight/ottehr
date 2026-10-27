import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { PaymentNotice } from 'fhir/r4b';
import { BILLING_RESOURCE_TAG, PAYMENT_METHOD_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { buildPaymentRefundsExtension, buildPaymentVoidExtension } from 'utils/lib/fhir/paymentRefunds';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/shared/sentry', () => ({ wrapHandler: (_name: string, handler: unknown) => handler }));
vi.mock('../../../src/shared/auth', () => ({
  checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('token'),
  getUserToken: vi.fn().mockReturnValue('user-token'),
  requireUserWithRole: vi.fn().mockResolvedValue({ id: 'user-1', profile: 'Practitioner/pr-1', name: 'Pat Admin' }),
}));
vi.mock('../../../src/shared/practitioners', () => ({
  practitionerRefForUser: vi.fn().mockResolvedValue({ reference: 'Practitioner/pr-1', display: 'Pat Admin' }),
}));
vi.mock('../../../src/shared/helpers', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  createClinicalOystehrClient: vi.fn(),
}));
vi.mock('../../../src/billing/shared', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  createBillingClient: vi.fn(),
}));
const paymentIntentsRetrieve = vi.fn();
vi.mock('../../../src/shared/stripeIntegration', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  voidPaymentNotice: vi.fn(),
  getStripeClient: vi.fn(() => ({ paymentIntents: { retrieve: paymentIntentsRetrieve } })),
}));
vi.mock('utils/lib/fhir/payments', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getStripeAccountForAppointmentOrEncounter: vi.fn().mockResolvedValue('acct_1'),
}));
vi.mock('../../../src/billing/payments', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  findBillingClaimForEncounter: vi.fn().mockResolvedValue(undefined),
}));

import { CLINICAL_PAYMENT_NOTICE_ID_SYSTEM, MANUAL_REFUND_ID_SYSTEM } from '../../../src/billing/payments';
import { createBillingClient, STRIPE_ACCOUNT_IDENTIFIER_SYSTEM } from '../../../src/billing/shared';
import { index } from '../../../src/billing/void-billing-patient-payment';
import { createClinicalOystehrClient } from '../../../src/shared/helpers';
import { STRIPE_PAYMENT_ID_SYSTEM, voidPaymentNotice } from '../../../src/shared/stripeIntegration';
import { ZambdaInput } from '../../../src/shared/types/common';

const NOTICE_ID = '2e9e1a9e-5a1f-4b6e-9a51-9f6a3f1c2d3e';
const LEGACY_NOTICE_ID = '7b1c4a2e-0d3f-4c5b-8e6a-1f2d3c4b5a69';
const ENCOUNTER_ID = '0f6c1d8e-3a2b-4c5d-9e8f-7a6b5c4d3e2f';

const bridgedCopy: PaymentNotice = {
  resourceType: 'PaymentNotice',
  id: NOTICE_ID,
  meta: { versionId: '5', tag: [BILLING_RESOURCE_TAG] },
  status: 'active',
  amount: { value: 50, currency: 'USD' },
  request: { type: 'Claim', identifier: { system: ottehrIdentifierSystem('claim-encounter-id'), value: ENCOUNTER_ID } },
  identifier: [{ system: CLINICAL_PAYMENT_NOTICE_ID_SYSTEM, value: LEGACY_NOTICE_ID }],
  extension: [{ url: PAYMENT_METHOD_EXTENSION_URL, valueString: 'cash' }],
} as PaymentNotice;

const legacyNotice = (
  extension: PaymentNotice['extension'],
  status: PaymentNotice['status'] = 'active'
): PaymentNotice =>
  ({
    resourceType: 'PaymentNotice',
    id: LEGACY_NOTICE_ID,
    status,
    amount: { value: 50, currency: 'USD' },
    request: { reference: `Encounter/${ENCOUNTER_ID}` },
    extension: [{ url: PAYMENT_METHOD_EXTENSION_URL, valueString: 'cash' }, ...(extension ?? [])],
  }) as PaymentNotice;

const clinicalGet = vi.fn();
const billingGet = vi.fn();
const billingSearch = vi.fn();
const billingCreate = vi.fn();
const billingPatch = vi.fn();

const invoke = (paymentNoticeId = NOTICE_ID, secrets: object = {}): Promise<APIGatewayProxyResult> =>
  (index as (input: ZambdaInput) => Promise<APIGatewayProxyResult>)({
    body: JSON.stringify({ encounterId: ENCOUNTER_ID, paymentNoticeId, reason: 'Other' }),
    headers: { Authorization: 'Bearer user-token' },
    secrets: { DEFAULT_BILLING_RESOURCE: 'Organization/billing-org', ...secrets },
  } as unknown as ZambdaInput);

const legacyRefund = buildPaymentRefundsExtension([
  { stripeRefundId: 'manual_legacy', amountInCents: 5000, dateISO: '2026-04-20T13:00:00Z', status: 'succeeded' },
]);

const refundOffsetCreates = (): PaymentNotice[] =>
  billingCreate.mock.calls
    .map(([resource]) => resource as PaymentNotice)
    .filter((resource) => (resource.amount?.value ?? 0) < 0);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createClinicalOystehrClient).mockReturnValue({ fhir: { get: clinicalGet } } as unknown as Oystehr);
  vi.mocked(createBillingClient).mockReturnValue({
    fhir: { get: billingGet, search: billingSearch, create: billingCreate, patch: billingPatch },
  } as unknown as Oystehr);
  billingGet.mockResolvedValue(bridgedCopy);
  billingSearch.mockImplementation(async ({ resourceType }: { resourceType: string }) => ({
    unbundle: () => (resourceType === 'Organization' ? [{ resourceType: 'Organization', id: 'stripe-org' }] : []),
  }));
  billingCreate.mockImplementation(async (resource: PaymentNotice) => ({ ...resource, id: 'adopted-1' }));
  billingPatch.mockImplementation(async ({ operations }) => ({
    ...bridgedCopy,
    status: operations.find((op: { path: string }) => op.path === '/status')?.value ?? bridgedCopy.status,
    extension: operations.find((op: { path: string }) => op.path === '/extension').value,
  }));
});

describe('void-billing-patient-payment', () => {
  it('voids the billing notice', async () => {
    clinicalGet.mockResolvedValue(legacyNotice([]));

    const result = await invoke();

    expect(billingPatch).not.toHaveBeenCalled();
    expect(vi.mocked(voidPaymentNotice).mock.calls[0][1].id).toBe(NOTICE_ID);
    expect(vi.mocked(voidPaymentNotice).mock.calls[0][2]).toMatchObject({ reason: 'Other', voidedBy: 'Pat Admin' });
    expect(JSON.parse(result.body)).toEqual({ paymentNoticeId: NOTICE_ID, voidedBillingNoticeCount: 1 });
  });

  it('rejects voiding a payment refunded before its billing copy existed', async () => {
    clinicalGet.mockResolvedValue(
      legacyNotice([
        buildPaymentRefundsExtension([
          {
            stripeRefundId: 'manual_legacy',
            amountInCents: 1000,
            dateISO: '2026-04-20T13:00:00Z',
            status: 'succeeded',
          },
        ]),
      ])
    );

    await expect(invoke()).rejects.toMatchObject({
      message: 'This payment has refunds recorded and can no longer be voided.',
    });
    expect(billingPatch.mock.calls[0][0].operations[0]).toEqual({ op: 'test', path: '/meta/versionId', value: '5' });
    expect(voidPaymentNotice).not.toHaveBeenCalled();
  });

  it('treats a payment voided only on the legacy notice as already voided', async () => {
    clinicalGet.mockResolvedValue(
      legacyNotice([buildPaymentVoidExtension({ reason: 'Other', voidedAtISO: '2026-04-20T13:00:00Z' })], 'cancelled')
    );

    await expect(invoke()).rejects.toMatchObject({ message: 'This payment has already been voided.' });
    expect(billingPatch.mock.calls[0][0].operations).toContainEqual({
      op: 'replace',
      path: '/status',
      value: 'cancelled',
    });
    expect(voidPaymentNotice).not.toHaveBeenCalled();
  });

  it('copies a legacy card payment keyed by its charge id, so the webhook merges into the copy', async () => {
    billingGet.mockRejectedValue({ code: 404 });
    clinicalGet.mockResolvedValue({
      ...legacyNotice([]),
      identifier: [{ system: STRIPE_PAYMENT_ID_SYSTEM, value: 'pi_1' }],
      extension: [{ url: PAYMENT_METHOD_EXTENSION_URL, valueString: 'card' }],
    });
    paymentIntentsRetrieve.mockResolvedValue({ id: 'pi_1', latest_charge: 'ch_1' });

    // card payments cannot be voided, but the copy is made before that check
    await expect(invoke(LEGACY_NOTICE_ID)).rejects.toMatchObject({
      message: 'Only cash, check, and external card reader payments can be voided.',
    });

    expect(paymentIntentsRetrieve).toHaveBeenCalledWith('pi_1', undefined, { stripeAccount: 'acct_1' });
    expect(billingSearch.mock.calls[0][0].params[0].value).toContain(`${STRIPE_PAYMENT_ID_SYSTEM}|ch_1`);
    const [copy, options] = billingCreate.mock.calls[0];
    expect(copy.identifier).toEqual([
      { system: STRIPE_PAYMENT_ID_SYSTEM, value: 'pi_1' },
      { system: CLINICAL_PAYMENT_NOTICE_ID_SYSTEM, value: LEGACY_NOTICE_ID },
      { system: STRIPE_PAYMENT_ID_SYSTEM, value: 'ch_1' },
    ]);
    expect(options.ifNoneExist[0]).toEqual({ name: 'identifier', value: `${STRIPE_PAYMENT_ID_SYSTEM}|ch_1` });
    // the same payee the webhook gives the charge: the org behind its connected account
    expect(billingSearch).toHaveBeenCalledWith({
      resourceType: 'Organization',
      params: [{ name: 'identifier', value: `${STRIPE_ACCOUNT_IDENTIFIER_SYSTEM}|acct_1` }],
    });
    expect(copy.payee).toEqual({ reference: 'Organization/stripe-org' });
  });

  it('does not touch Stripe when copying a cash payment', async () => {
    billingGet.mockRejectedValue({ code: 404 });
    clinicalGet.mockResolvedValue(legacyNotice([]));

    await invoke(LEGACY_NOTICE_ID);

    expect(paymentIntentsRetrieve).not.toHaveBeenCalled();
    expect(billingCreate.mock.calls[0][1].ifNoneExist[0]).toEqual({
      name: 'identifier',
      value: `${CLINICAL_PAYMENT_NOTICE_ID_SYSTEM}|${LEGACY_NOTICE_ID}`,
    });
    expect(vi.mocked(voidPaymentNotice).mock.calls[0][1].id).toBe('adopted-1');
  });

  it('records the billing offset of a refund that only the legacy notice carries, before rejecting', async () => {
    billingGet.mockRejectedValue({ code: 404 });
    clinicalGet.mockResolvedValue(legacyNotice([legacyRefund]));

    await expect(invoke(LEGACY_NOTICE_ID, { BILLING_INTEGRATION: 'ottehr' })).rejects.toMatchObject({
      message: 'This payment has refunds recorded and can no longer be voided.',
    });

    const [offset] = refundOffsetCreates();
    expect(offset.amount).toEqual({ value: -50, currency: 'USD' });
    expect(offset.identifier).toEqual([{ system: MANUAL_REFUND_ID_SYSTEM, value: 'manual_legacy' }]);
    const offsetCall = billingCreate.mock.calls.find(([resource]) => resource === offset);
    expect(offsetCall?.[1].ifNoneExist[0]).toEqual({
      name: 'identifier',
      value: `${MANUAL_REFUND_ID_SYSTEM}|manual_legacy`,
    });
  });

  it('records the offset again when a retry finds the copy already made', async () => {
    clinicalGet.mockResolvedValue(legacyNotice([legacyRefund]));

    await expect(invoke(NOTICE_ID, { BILLING_INTEGRATION: 'ottehr' })).rejects.toMatchObject({
      message: 'This payment has refunds recorded and can no longer be voided.',
    });

    expect(refundOffsetCreates()).toHaveLength(1);
  });

  it('writes no offsets while Ottehr billing is off', async () => {
    billingGet.mockRejectedValue({ code: 404 });
    clinicalGet.mockResolvedValue(legacyNotice([legacyRefund]));

    await expect(invoke(LEGACY_NOTICE_ID)).rejects.toThrow();

    expect(refundOffsetCreates()).toHaveLength(0);
  });
});
