import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { PaymentNotice } from 'fhir/r4b';
import { BILLING_RESOURCE_TAG, PAYMENT_METHOD_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { buildPaymentRefundsExtension } from 'utils/lib/fhir/paymentRefunds';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { getOrCreateCandidApiClient } from 'utils/lib/helpers/candidApi';
import { PaymentRefundDTO } from 'utils/lib/types/api/patient-payment-types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks (hoisted before imports) ─────────────────────────────────────────────

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
vi.mock('../../../src/billing/payments', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  recordBillingManualRefund: vi.fn(),
  findBillingClaimForEncounter: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../../src/shared/stripeIntegration', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  applyRefundsToPaymentNotice: vi.fn(),
  getStripeClient: vi.fn().mockReturnValue({}),
}));
vi.mock('utils/lib/helpers/candidApi', () => ({ getOrCreateCandidApiClient: vi.fn() }));
vi.mock('utils/lib/fhir/payments', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getStripeAccountForAppointmentOrEncounter: vi.fn().mockResolvedValue('acct_schedule'),
}));
// transitive imports of shared/candid that pull heavy modules
vi.mock('../../../src/ehr/shared/harvest', () => ({ getAccountAndCoverageResourcesForPatient: vi.fn() }));
vi.mock('../../../src/shared/chart-data', () => ({ chartDataResourceHasMetaTagByCode: vi.fn() }));

// ── Imports ────────────────────────────────────────────────────────────────────

import {
  CLINICAL_PAYMENT_NOTICE_ID_SYSTEM,
  recordBillingManualRefund,
  stripeAccountExtension,
} from '../../../src/billing/payments';
import { index } from '../../../src/billing/refund-billing-patient-payment';
import { createBillingClient, STRIPE_ACCOUNT_IDENTIFIER_SYSTEM } from '../../../src/billing/shared';
import { CANDID_PRE_ENCOUNTER_APPOINTMENT_ID_IDENTIFIER_SYSTEM } from '../../../src/shared/candid';
import { createClinicalOystehrClient } from '../../../src/shared/helpers';
import {
  applyRefundsToPaymentNotice,
  getStripeClient,
  STRIPE_PAYMENT_ID_SYSTEM,
} from '../../../src/shared/stripeIntegration';
import { ZambdaInput } from '../../../src/shared/types/common';

// ── Fixtures ───────────────────────────────────────────────────────────────────

const NOTICE_ID = '2e9e1a9e-5a1f-4b6e-9a51-9f6a3f1c2d3e';
const LEGACY_NOTICE_ID = '7b1c4a2e-0d3f-4c5b-8e6a-1f2d3c4b5a69';
const ENCOUNTER_ID = '0f6c1d8e-3a2b-4c5d-9e8f-7a6b5c4d3e2f';
const IDEMPOTENCY_KEY = 'b7f3c2a1-9d8e-4f6a-8b5c-3e2d1f0a9b8c';
const PATIENT_ID = 'patient-1';
const CANDID_APPOINTMENT_ID = 'candid-appt-1';
const CLAIM_ENCOUNTER_ID_SYSTEM = ottehrIdentifierSystem('claim-encounter-id');

const manualRefund: PaymentRefundDTO = {
  stripeRefundId: `manual_${NOTICE_ID}_key-1`,
  amountInCents: 1000,
  dateISO: '2026-04-22T13:00:00Z',
  status: 'succeeded',
  reason: 'Overcharge',
};
const pendingReservation: PaymentRefundDTO = {
  stripeRefundId: `manual_pending_${NOTICE_ID}_key-3`,
  amountInCents: 250,
  dateISO: new Date().toISOString(),
  status: 'pending',
};

function makeBillingNotice(refunds: PaymentRefundDTO[]): PaymentNotice {
  return {
    resourceType: 'PaymentNotice',
    id: NOTICE_ID,
    meta: { tag: [BILLING_RESOURCE_TAG] },
    status: 'active',
    amount: { value: 50, currency: 'USD' },
    request: { type: 'Claim', identifier: { system: CLAIM_ENCOUNTER_ID_SYSTEM, value: ENCOUNTER_ID } },
    extension: [{ url: PAYMENT_METHOD_EXTENSION_URL, valueString: 'cash' }, buildPaymentRefundsExtension(refunds)],
  } as PaymentNotice;
}

function makeLegacyNotice(): PaymentNotice {
  return {
    resourceType: 'PaymentNotice',
    id: LEGACY_NOTICE_ID,
    meta: { versionId: '3' },
    status: 'active',
    amount: { value: 50, currency: 'USD' },
    request: { reference: `Encounter/${ENCOUNTER_ID}`, type: 'Encounter' },
    recipient: { reference: 'Organization/clinic' },
    extension: [{ url: PAYMENT_METHOD_EXTENSION_URL, valueString: 'check' }],
  } as PaymentNotice;
}

const notFound = { code: 404 };

const clinicalGet = vi.fn();
const clinicalSearch = vi.fn();
const billingGet = vi.fn();
const billingSearch = vi.fn();
const billingCreate = vi.fn();
const billingPatch = vi.fn();
const candidGetMulti = vi.fn();
const candidCreate = vi.fn();

const invoke = (billingIntegration: string, body: Record<string, unknown> = {}): Promise<APIGatewayProxyResult> =>
  (index as (input: ZambdaInput) => Promise<APIGatewayProxyResult>)({
    body: JSON.stringify({
      encounterId: ENCOUNTER_ID,
      paymentNoticeId: NOTICE_ID,
      reason: 'Overcharge',
      amountInCents: 500,
      idempotencyKey: IDEMPOTENCY_KEY,
      ...body,
    }),
    headers: { Authorization: 'Bearer user-token' },
    secrets: { BILLING_INTEGRATION: billingIntegration, DEFAULT_BILLING_RESOURCE: 'Organization/billing-org' },
  } as unknown as ZambdaInput);

const stampedRefunds = (): PaymentRefundDTO[] => vi.mocked(applyRefundsToPaymentNotice).mock.calls[0][2];

beforeEach(() => {
  vi.clearAllMocks();
  billingGet.mockResolvedValue(makeBillingNotice([manualRefund, pendingReservation]));
  billingSearch.mockResolvedValue({ unbundle: () => [] });
  billingCreate.mockImplementation(async (resource: PaymentNotice) => ({
    ...resource,
    id: 'adopted-1',
    meta: { tag: [BILLING_RESOURCE_TAG] },
  }));
  clinicalGet.mockRejectedValue(notFound);
  clinicalSearch.mockReturnValue({
    unbundle: () => [
      { resourceType: 'Patient', id: PATIENT_ID },
      {
        resourceType: 'Appointment',
        id: 'appt-1',
        identifier: [{ system: CANDID_PRE_ENCOUNTER_APPOINTMENT_ID_IDENTIFIER_SYSTEM, value: CANDID_APPOINTMENT_ID }],
      },
      { resourceType: 'Encounter', id: ENCOUNTER_ID },
    ],
  });
  candidGetMulti.mockResolvedValue({ ok: true, body: { items: [] } });
  candidCreate.mockResolvedValue({ ok: true, body: { patientRefundId: 'candid-refund-1' } });

  vi.mocked(createClinicalOystehrClient).mockReturnValue({
    fhir: { get: clinicalGet, search: clinicalSearch },
  } as unknown as Oystehr);
  vi.mocked(createBillingClient).mockReturnValue({
    fhir: { get: billingGet, search: billingSearch, create: billingCreate, patch: billingPatch },
  } as unknown as Oystehr);
  vi.mocked(getOrCreateCandidApiClient).mockResolvedValue({
    patientRefunds: { v1: { getMulti: candidGetMulti, create: candidCreate } },
  } as any);
});

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('refund-billing-patient-payment manual refunds', () => {
  it('stamps the refund on the billing notice, keyed by the scoped idempotency key', async () => {
    const result = await invoke('ottehr');

    expect(vi.mocked(applyRefundsToPaymentNotice).mock.calls[0][1].id).toBe(NOTICE_ID);
    const newRefund = stampedRefunds().find(
      (refund) => refund.stripeRefundId === `manual_${NOTICE_ID}_${IDEMPOTENCY_KEY}`
    );
    expect(newRefund).toMatchObject({ amountInCents: 500, reason: 'Overcharge', refundedBy: 'Pat Admin' });
    expect(JSON.parse(result.body)).toEqual({ refundId: `manual_${NOTICE_ID}_${IDEMPOTENCY_KEY}`, amountInCents: 500 });
  });

  it('pushes only settled FHIR-only refunds to Candid and records no AR offsets in a candid-only env', async () => {
    await invoke('candid');

    // the earlier manual refund is re-synced with the new one; the pending reservation is not a refund
    expect(candidCreate.mock.calls.map(([arg]) => arg.amountCents)).toEqual([1000, 500]);
    expect(candidCreate.mock.calls.map(([arg]) => arg.refundNote).join('\n')).not.toContain('manual_pending_');
    expect(recordBillingManualRefund).not.toHaveBeenCalled();
  });

  it('records AR offsets and skips Candid when BILLING_INTEGRATION is ottehr', async () => {
    await invoke('ottehr');

    expect(getOrCreateCandidApiClient).not.toHaveBeenCalled();
    // the existing refund's offset is reconciled when the notice is resolved, then every local
    // refund is re-synced with the new one; the writer dedups on the refund id
    expect(vi.mocked(recordBillingManualRefund).mock.calls.map(([, entry]) => entry.amountInCents)).toEqual([
      1000, 1000, 500,
    ]);
    expect(vi.mocked(recordBillingManualRefund).mock.calls[0][1]).toMatchObject({
      encounterId: ENCOUNTER_ID,
      paymentMethod: 'cash',
    });
  });

  it('records both AR offsets and Candid refunds when BILLING_INTEGRATION is all', async () => {
    await invoke('all');

    expect(recordBillingManualRefund).toHaveBeenCalledTimes(3);
    expect(candidCreate).toHaveBeenCalledTimes(2);
  });

  it('fails the request when the Candid create fails so a retry can heal it', async () => {
    candidCreate.mockResolvedValue({ ok: false, error: { errorName: 'boom' } });

    await expect(invoke('candid')).rejects.toThrow('Error creating Candid patient refund');
  });

  it('rejects a payment that belongs to another encounter', async () => {
    await expect(invoke('ottehr', { encounterId: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d' })).rejects.toMatchObject({
      message: 'PaymentNotice does not belong to the specified encounter.',
    });
    expect(applyRefundsToPaymentNotice).not.toHaveBeenCalled();
  });
});

describe('refund-billing-patient-payment legacy EHR notices', () => {
  beforeEach(() => {
    billingGet.mockRejectedValue(notFound);
    clinicalGet.mockResolvedValue(makeLegacyNotice());
  });

  it('adopts the legacy notice into billing and refunds the copy', async () => {
    await invoke('ottehr', { paymentNoticeId: LEGACY_NOTICE_ID });

    expect(billingCreate).toHaveBeenCalledOnce();
    const [copy, options] = billingCreate.mock.calls[0];
    expect(copy).toMatchObject({
      request: { type: 'Claim', identifier: { system: CLAIM_ENCOUNTER_ID_SYSTEM, value: ENCOUNTER_ID } },
      payee: { reference: 'Organization/billing-org' },
      identifier: [{ system: CLINICAL_PAYMENT_NOTICE_ID_SYSTEM, value: LEGACY_NOTICE_ID }],
    });
    expect(copy.id).toBeUndefined();
    expect(copy.meta).toBeUndefined();
    expect(options.ifNoneExist).toContainEqual({
      name: 'identifier',
      value: `${CLINICAL_PAYMENT_NOTICE_ID_SYSTEM}|${LEGACY_NOTICE_ID}`,
    });

    expect(vi.mocked(applyRefundsToPaymentNotice).mock.calls[0][1].id).toBe('adopted-1');
    // the legacy notice itself is never written
    expect(clinicalGet).toHaveBeenCalledOnce();
    expect(vi.mocked(recordBillingManualRefund).mock.calls[0][1]).toMatchObject({ paymentMethod: 'check' });
  });

  it('reuses a billing copy the cash/check bridge already wrote', async () => {
    const bridgedCopy = {
      ...makeBillingNotice([]),
      id: 'bridged-1',
      identifier: [{ system: CLINICAL_PAYMENT_NOTICE_ID_SYSTEM, value: LEGACY_NOTICE_ID }],
    };
    billingSearch.mockResolvedValue({ unbundle: () => [bridgedCopy] });

    await invoke('ottehr', { paymentNoticeId: LEGACY_NOTICE_ID });

    expect(billingCreate).not.toHaveBeenCalled();
    expect(vi.mocked(applyRefundsToPaymentNotice).mock.calls[0][1].id).toBe('bridged-1');
  });

  it('carries a refund recorded only on the legacy notice before validating the new one', async () => {
    const legacyRefund: PaymentRefundDTO = {
      stripeRefundId: 'manual_legacy',
      amountInCents: 4000,
      dateISO: '2026-04-20T13:00:00Z',
      status: 'succeeded',
      reason: 'Overcharge',
    };
    // the bridge copied the $50 payment after the refund was stamped clinically, without it
    const bridgedCopy = {
      ...makeBillingNotice([]),
      meta: { versionId: '5', tag: [BILLING_RESOURCE_TAG] },
      identifier: [{ system: CLINICAL_PAYMENT_NOTICE_ID_SYSTEM, value: LEGACY_NOTICE_ID }],
    };
    billingGet.mockResolvedValue(bridgedCopy);
    clinicalGet.mockResolvedValue({
      ...makeLegacyNotice(),
      extension: [
        { url: PAYMENT_METHOD_EXTENSION_URL, valueString: 'cash' },
        buildPaymentRefundsExtension([legacyRefund]),
      ],
    });
    billingPatch.mockImplementation(async ({ operations }) => ({
      ...bridgedCopy,
      meta: { versionId: '6', tag: [BILLING_RESOURCE_TAG] },
      extension: operations.find((op: { path: string }) => op.path === '/extension').value,
    }));

    await expect(invoke('ottehr', { paymentNoticeId: NOTICE_ID, amountInCents: 2000 })).rejects.toMatchObject({
      message: 'Refund amount exceeds the remaining refundable amount of 10.00.',
    });

    expect(clinicalGet).toHaveBeenCalledWith({ resourceType: 'PaymentNotice', id: LEGACY_NOTICE_ID });
    const { operations } = billingPatch.mock.calls[0][0];
    expect(operations[0]).toEqual({ op: 'test', path: '/meta/versionId', value: '5' });
    expect(applyRefundsToPaymentNotice).not.toHaveBeenCalled();
  });

  it('reports a payment id that neither workspace knows as not found', async () => {
    clinicalGet.mockRejectedValue(notFound);

    await expect(invoke('ottehr', { paymentNoticeId: LEGACY_NOTICE_ID })).rejects.toMatchObject({
      message: 'The requested PaymentNotice resource could not be found',
    });
  });

  describe('Stripe account', () => {
    const refundsList = vi.fn();
    const paymentIntentsRetrieve = vi.fn();
    const cardNotice = (payee: string, stamp?: { stripeAccount: string | undefined }): PaymentNotice =>
      ({
        ...makeBillingNotice([]),
        payee: { reference: payee },
        identifier: [{ system: STRIPE_PAYMENT_ID_SYSTEM, value: 'pi_1' }],
        extension: [
          { url: PAYMENT_METHOD_EXTENSION_URL, valueString: 'card' },
          ...(stamp ? [stripeAccountExtension(stamp.stripeAccount)] : []),
        ],
      }) as PaymentNotice;
    const organizations: Record<string, object> = {
      'clinic-org': {
        resourceType: 'Organization',
        id: 'clinic-org',
        identifier: [{ system: STRIPE_ACCOUNT_IDENTIFIER_SYSTEM, value: 'acct_clinic' }],
      },
      'platform-org': { resourceType: 'Organization', id: 'platform-org' },
    };
    const withPayee = (payee: string, stamp?: { stripeAccount: string | undefined }): void => {
      billingGet.mockImplementation(async ({ resourceType, id }: { resourceType: string; id: string }) =>
        resourceType === 'Organization' ? organizations[id] : cardNotice(payee, stamp)
      );
    };
    const invokeExternal = (): Promise<APIGatewayProxyResult> =>
      invoke('candid', { external: true, medium: 'cash', idempotencyKey: undefined });

    beforeEach(() => {
      refundsList.mockResolvedValue({ data: [] });
      paymentIntentsRetrieve.mockResolvedValue({ metadata: {} });
      vi.mocked(getStripeClient).mockReturnValue({
        refunds: { list: refundsList },
        paymentIntents: { retrieve: paymentIntentsRetrieve, update: vi.fn() },
      } as unknown as ReturnType<typeof getStripeClient>);
    });

    it('uses the platform account for a payment stamped with it, as outreach invoices are', async () => {
      withPayee('Organization/platform-org', { stripeAccount: undefined });

      await invokeExternal();

      expect(refundsList).toHaveBeenCalledWith({ payment_intent: 'pi_1', limit: 100 }, { stripeAccount: undefined });
      expect(paymentIntentsRetrieve).toHaveBeenCalledWith('pi_1', { stripeAccount: undefined });
    });

    it('uses the stamped connected account when no billing provider carries it', async () => {
      withPayee('Organization/platform-org', { stripeAccount: 'acct_unmapped' });

      await invokeExternal();

      expect(refundsList).toHaveBeenCalledWith(
        { payment_intent: 'pi_1', limit: 100 },
        { stripeAccount: 'acct_unmapped' }
      );
    });

    it("uses an unstamped payment's payee account instead of the schedule's", async () => {
      withPayee('Organization/clinic-org');

      await invokeExternal();

      expect(refundsList).toHaveBeenCalledWith(
        { payment_intent: 'pi_1', limit: 100 },
        { stripeAccount: 'acct_clinic' }
      );
    });
  });
});
