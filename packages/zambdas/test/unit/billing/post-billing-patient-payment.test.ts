import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Claim, PaymentNotice, Provenance } from 'fhir/r4b';
import { BILLING_RESOURCE_TAG, PAYMENT_METHOD_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { buildPaymentRefundsExtension } from 'utils/lib/fhir/paymentRefunds';
import { getPaymentNoticeSubmitterRef, getStripeAccountForAppointmentOrEncounter } from 'utils/lib/fhir/payments';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { CLAIM_PROVENANCE_ACTIVITY } from 'utils/lib/types/data/billing/claim-history';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks (hoisted before imports) ─────────────────────────────────────────────

const paymentIntentsCreate = vi.fn();

vi.mock('../../../src/shared/sentry', () => ({ wrapHandler: (_name: string, handler: unknown) => handler }));
vi.mock('../../../src/shared/auth', () => ({
  checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('token'),
  getUserToken: vi.fn().mockReturnValue('user-token'),
  getUser: vi.fn().mockResolvedValue({ id: 'user-1', profile: 'Practitioner/pr-1', name: 'Front Desk' }),
}));
vi.mock('../../../src/shared/practitioners', () => ({
  practitionerRefForUser: vi.fn().mockResolvedValue({ reference: 'Practitioner/pr-1', display: 'Front Desk' }),
}));
vi.mock('../../../src/shared/helpers', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  createClinicalOystehrClient: vi.fn(),
}));
vi.mock('../../../src/billing/shared', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  createBillingClient: vi.fn(),
  fetchById: vi.fn().mockResolvedValue({ resourceType: 'Encounter', id: 'enc' }),
}));
vi.mock('../../../src/billing/payments', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  reconcilePaymentNoticesForClaim: vi.fn(),
  findBillingClaimForEncounter: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../../src/shared/stripeIntegration', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getStripeClient: vi.fn(() => ({ paymentIntents: { create: paymentIntentsCreate } })),
}));
vi.mock('../../../src/ehr/shared/harvest', () => ({
  getAccountAndCoverageResourcesForPatient: vi.fn().mockResolvedValue({ account: { id: 'account-1' } }),
}));
vi.mock('utils/lib/fhir/helpers', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getStripeCustomerIdFromAccount: vi.fn().mockReturnValue('cus_1'),
}));
vi.mock('utils/lib/fhir/payments', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getStripeAccountForAppointmentOrEncounter: vi.fn().mockResolvedValue(undefined),
}));

// ── Imports ────────────────────────────────────────────────────────────────────

import {
  EHR_PATIENT_PAYMENT_ID_SYSTEM,
  findBillingClaimForEncounter,
  reconcilePaymentNoticesForClaim,
  stripeAccountExtension,
} from '../../../src/billing/payments';
import { index } from '../../../src/billing/post-billing-patient-payment';
import { createBillingClient, STRIPE_ACCOUNT_IDENTIFIER_SYSTEM } from '../../../src/billing/shared';
import { createClinicalOystehrClient } from '../../../src/shared/helpers';
import { STRIPE_PAYMENT_ID_SYSTEM } from '../../../src/shared/stripeIntegration';
import { ZambdaInput } from '../../../src/shared/types/common';

// ── Fixtures ───────────────────────────────────────────────────────────────────

const PATIENT_ID = '5d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a';
const ENCOUNTER_ID = '0f6c1d8e-3a2b-4c5d-9e8f-7a6b5c4d3e2f';
const IDEMPOTENCY_KEY = 'b7f3c2a1-9d8e-4f6a-8b5c-3e2d1f0a9b8c';
const DEDUP_VALUE = `${ENCOUNTER_ID}_${IDEMPOTENCY_KEY}`;

const billingSearch = vi.fn();
const billingGet = vi.fn();
const billingTransaction = vi.fn();
const clinicalCreate = vi.fn();

const invoke = (paymentDetails: Record<string, unknown>): Promise<APIGatewayProxyResult> =>
  (index as (input: ZambdaInput) => Promise<APIGatewayProxyResult>)({
    body: JSON.stringify({ patientId: PATIENT_ID, encounterId: ENCOUNTER_ID, paymentDetails }),
    headers: { Authorization: 'Bearer user-token' },
    secrets: { DEFAULT_BILLING_RESOURCE: 'Organization/billing-org' },
  } as unknown as ZambdaInput);

interface WriteRequest {
  method: string;
  url: string;
  resource?: PaymentNotice | Provenance;
  ifNoneExist?: { name: string; value: string }[];
  ifMatch?: string;
}

const writes = (): WriteRequest[] => billingTransaction.mock.calls.flatMap(([{ requests }]) => requests);
const noticeCreates = (): WriteRequest[] =>
  writes().filter((request) => request.method === 'POST' && request.url === '/PaymentNotice');
const createdNotice = (): PaymentNotice => noticeCreates()[0].resource as PaymentNotice;
const merges = (): WriteRequest[] => writes().filter((request) => request.method === 'PUT');
const mergedNotice = (): PaymentNotice => merges()[0].resource as PaymentNotice;
const historyEntries = (): Provenance[] =>
  writes()
    .filter((request) => request.url === '/Provenance')
    .map((request) => request.resource as Provenance);

// the conditional create matched a notice the webhook stored first, which it answers with 200
const webhookStoredFirst = (notice: PaymentNotice): void => {
  billingTransaction.mockImplementationOnce(async () => ({
    entry: [{ resource: notice, response: { status: '200 OK' } }],
    unbundle: () => [notice],
  }));
};

beforeEach(() => {
  vi.clearAllMocks();
  // the billing provider carrying the connected account; nothing else is found
  billingSearch.mockImplementation(async ({ resourceType }: { resourceType: string }) => ({
    unbundle: () => (resourceType === 'Organization' ? [{ resourceType: 'Organization', id: 'stripe-org' }] : []),
  }));
  billingTransaction.mockImplementation(async ({ requests }: { requests: WriteRequest[] }) => {
    const resources = requests.map((request) =>
      request.method === 'POST' && request.url === '/PaymentNotice'
        ? { ...request.resource, id: 'pn-1', meta: { versionId: '1', tag: [BILLING_RESOURCE_TAG] } }
        : request.resource
    );
    return {
      entry: resources.map((resource) => ({ resource, response: { status: '201 Created' } })),
      unbundle: () => resources,
    };
  });
  // reads return the latest version of the notice written
  billingGet.mockImplementation(async ({ id }: { id: string }) =>
    merges()
      .map((request) => request.resource)
      .reverse()
      .find((resource) => resource?.id === id)
  );
  vi.mocked(createBillingClient).mockReturnValue({
    fhir: { search: billingSearch, get: billingGet, transaction: billingTransaction },
  } as unknown as Oystehr);
  vi.mocked(createClinicalOystehrClient).mockReturnValue({ fhir: { create: clinicalCreate } } as unknown as Oystehr);
  paymentIntentsCreate.mockResolvedValue({ id: 'pi_1', status: 'succeeded', latest_charge: 'ch_1' });
  vi.mocked(getStripeAccountForAppointmentOrEncounter).mockResolvedValue('acct_1');
});

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('post-billing-patient-payment', () => {
  it('records a cash payment as a billing notice against the encounter claim and schedules its Task', async () => {
    const result = await invoke({ paymentMethod: 'cash', amountInCents: 2500, idempotencyKey: IDEMPOTENCY_KEY });

    const [{ ifNoneExist }] = noticeCreates();
    const notice = createdNotice();
    expect(notice).toMatchObject({
      status: 'active',
      amount: { value: 25, currency: 'USD' },
      request: {
        type: 'Claim',
        identifier: { system: ottehrIdentifierSystem('claim-encounter-id'), value: ENCOUNTER_ID },
      },
      payee: { reference: 'Organization/billing-org' },
      identifier: [{ system: EHR_PATIENT_PAYMENT_ID_SYSTEM, value: DEDUP_VALUE }],
      extension: [{ url: PAYMENT_METHOD_EXTENSION_URL, valueString: 'cash' }],
    });
    expect(getPaymentNoticeSubmitterRef(notice)).toEqual({ reference: 'Practitioner/pr-1', display: 'Front Desk' });
    expect(ifNoneExist).toEqual([
      { name: 'identifier', value: `${EHR_PATIENT_PAYMENT_ID_SYSTEM}|${DEDUP_VALUE}` },
      { name: '_tag', value: `${BILLING_RESOURCE_TAG.system}|${BILLING_RESOURCE_TAG.code}` },
    ]);
    expect(paymentIntentsCreate).not.toHaveBeenCalled();

    // the payment and its claim history entry, credited to the user who took it, commit together
    expect(billingTransaction).toHaveBeenCalledTimes(1);
    const [entry] = historyEntries();
    expect(entry.activity?.coding?.[0]).toEqual(CLAIM_PROVENANCE_ACTIVITY.create);
    expect(entry.agent).toEqual([
      expect.objectContaining({ who: { reference: 'Practitioner/pr-1', display: 'Front Desk' } }),
    ]);

    // the Task is clinical, written with the clinical client and focused on the billing notice
    const [task, taskOptions] = clinicalCreate.mock.calls[0];
    expect(task.focus).toEqual({ type: 'PaymentNotice', reference: 'PaymentNotice/pn-1' });
    expect(taskOptions.ifNoneExist).toContainEqual({ name: 'focus', value: 'PaymentNotice/pn-1' });

    expect(JSON.parse(result.body)).toMatchObject({ notice: { id: 'pn-1' }, encounterId: ENCOUNTER_ID });
  });

  it('records a cash payment posted after its claim exists in that claim history', async () => {
    const claim = { resourceType: 'Claim', id: 'claim-1', provider: { reference: 'Organization/provider' } } as Claim;
    vi.mocked(findBillingClaimForEncounter).mockResolvedValueOnce(claim);

    await invoke({ paymentMethod: 'cash', amountInCents: 2500, idempotencyKey: IDEMPOTENCY_KEY });

    expect(createdNotice().request?.reference).toBe('Claim/claim-1');
    expect(historyEntries()[0].target).toContainEqual({ reference: 'Claim/claim-1' });
    expect(reconcilePaymentNoticesForClaim).not.toHaveBeenCalled();
  });

  it('gives a payment without a client key an identifier billing AR can find', async () => {
    await invoke({ paymentMethod: 'check', amountInCents: 1000 });

    expect(billingSearch).not.toHaveBeenCalled();
    const notice = createdNotice();
    expect(notice.identifier?.[0].system).toBe(EHR_PATIENT_PAYMENT_ID_SYSTEM);
    expect(notice.identifier?.[0].value).toMatch(new RegExp(`^${ENCOUNTER_ID}_`));
  });

  it('returns the recorded notice on a replay without charging the card again', async () => {
    const existing = { resourceType: 'PaymentNotice', id: 'pn-existing', amount: { value: 40 } };
    billingSearch.mockResolvedValue({ unbundle: () => [existing] });

    const result = await invoke({
      paymentMethod: 'card',
      amountInCents: 4000,
      paymentMethodId: 'pm_1',
      idempotencyKey: IDEMPOTENCY_KEY,
    });

    expect(billingSearch.mock.calls[0][0].params).toEqual([
      { name: 'identifier', value: `${EHR_PATIENT_PAYMENT_ID_SYSTEM}|${DEDUP_VALUE}` },
    ]);
    expect(paymentIntentsCreate).not.toHaveBeenCalled();
    expect(billingTransaction).not.toHaveBeenCalled();
    expect(clinicalCreate.mock.calls[0][0].focus.reference).toBe('PaymentNotice/pn-existing');
    expect(JSON.parse(result.body).notice.id).toBe('pn-existing');
  });

  it('charges the card and dedups on the charge id the billing webhook also uses', async () => {
    await invoke({
      paymentMethod: 'card',
      amountInCents: 4000,
      paymentMethodId: 'pm_1',
      idempotencyKey: IDEMPOTENCY_KEY,
    });

    expect(paymentIntentsCreate.mock.calls[0][1]).toMatchObject({ idempotencyKey: IDEMPOTENCY_KEY });
    const [{ ifNoneExist }] = noticeCreates();
    const notice = createdNotice();
    expect(notice.identifier).toEqual([
      { system: EHR_PATIENT_PAYMENT_ID_SYSTEM, value: DEDUP_VALUE },
      { system: STRIPE_PAYMENT_ID_SYSTEM, value: 'pi_1' },
      { system: STRIPE_PAYMENT_ID_SYSTEM, value: 'ch_1' },
    ]);
    expect(ifNoneExist?.[0]).toEqual({ name: 'identifier', value: `${STRIPE_PAYMENT_ID_SYSTEM}|ch_1` });
    // payee is the org behind the connected account, as the webhook resolves it
    expect(billingSearch).toHaveBeenCalledWith({
      resourceType: 'Organization',
      params: [{ name: 'identifier', value: `${STRIPE_ACCOUNT_IDENTIFIER_SYSTEM}|acct_1` }],
    });
    expect(notice.payee).toEqual({ reference: 'Organization/stripe-org' });
    expect(notice.extension).toContainEqual(stripeAccountExtension('acct_1'));
    expect(notice.recipient).toEqual({ reference: 'Organization/stripe-org' });
    // the notice is ours, so there is nothing to merge
    expect(merges()).toEqual([]);
  });

  describe('claim link when merging into the notice the webhook wrote first', () => {
    const claim = { resourceType: 'Claim', id: 'claim-1', provider: { reference: 'Organization/provider' } } as Claim;
    const webhookNotice = (request: PaymentNotice['request']): PaymentNotice =>
      ({
        resourceType: 'PaymentNotice',
        id: 'pn-webhook',
        meta: { versionId: '4', tag: [BILLING_RESOURCE_TAG] },
        status: 'active',
        request,
        identifier: [{ system: STRIPE_PAYMENT_ID_SYSTEM, value: 'ch_1' }],
      }) as PaymentNotice;
    const encounterRequest = {
      type: 'Claim',
      identifier: { system: ottehrIdentifierSystem('claim-encounter-id'), value: ENCOUNTER_ID },
    };
    const postCard = (): Promise<APIGatewayProxyResult> =>
      invoke({ paymentMethod: 'card', amountInCents: 4000, paymentMethodId: 'pm_1', idempotencyKey: IDEMPOTENCY_KEY });

    it('links a notice stored before the claim existed through reconcile, so its history comes along', async () => {
      vi.mocked(findBillingClaimForEncounter).mockResolvedValueOnce(claim);
      webhookStoredFirst(webhookNotice(encounterRequest));

      await postCard();

      expect(mergedNotice().request).toEqual(encounterRequest);
      expect(reconcilePaymentNoticesForClaim).toHaveBeenCalledWith(expect.anything(), claim);
    });

    it('returns and schedules the notice as reconcile linked it', async () => {
      vi.mocked(findBillingClaimForEncounter).mockResolvedValueOnce(claim);
      webhookStoredFirst(webhookNotice(encounterRequest));
      const linked = {
        ...webhookNotice({ ...encounterRequest, reference: 'Claim/claim-1' }),
        meta: { versionId: '6' },
      };
      billingGet.mockResolvedValueOnce(linked);

      const result = await postCard();

      expect(vi.mocked(reconcilePaymentNoticesForClaim).mock.invocationCallOrder[0]).toBeLessThan(
        billingGet.mock.invocationCallOrder[0]
      );
      expect(billingGet).toHaveBeenCalledWith({ resourceType: 'PaymentNotice', id: 'pn-webhook' });
      expect(JSON.parse(result.body).notice.request.reference).toBe('Claim/claim-1');
    });

    it('keeps a claim link the notice already has', async () => {
      vi.mocked(findBillingClaimForEncounter).mockResolvedValueOnce(claim);
      webhookStoredFirst(webhookNotice({ ...encounterRequest, reference: 'Claim/claim-earlier' }));

      await postCard();

      expect(mergedNotice().request?.reference).toBe('Claim/claim-earlier');
      expect(reconcilePaymentNoticesForClaim).not.toHaveBeenCalled();
    });
  });

  it('merges into the notice the webhook wrote first, keeping its refund stamps', async () => {
    const refunds = buildPaymentRefundsExtension([
      { stripeRefundId: 're_1', amountInCents: 500, dateISO: '2026-04-22T16:00:00Z', status: 'succeeded' },
    ]);
    const webhookNotice = {
      resourceType: 'PaymentNotice',
      id: 'pn-webhook',
      meta: { versionId: '4', tag: [BILLING_RESOURCE_TAG] },
      status: 'active',
      identifier: [
        { system: STRIPE_PAYMENT_ID_SYSTEM, value: 'ch_1' },
        { system: STRIPE_PAYMENT_ID_SYSTEM, value: 'pi_1' },
      ],
      extension: [{ url: PAYMENT_METHOD_EXTENSION_URL, valueString: 'card' }, refunds],
      contained: [{ resourceType: 'PaymentReconciliation', id: 'contained-reconciliation' }],
    };
    webhookStoredFirst(webhookNotice as PaymentNotice);

    await invoke({
      paymentMethod: 'card',
      amountInCents: 4000,
      paymentMethodId: 'pm_1',
      idempotencyKey: IDEMPOTENCY_KEY,
    });

    expect(merges()[0].ifMatch).toBe('W/"4"');
    const merged = mergedNotice();
    expect(merged.id).toBe('pn-webhook');
    expect(merged.identifier).toEqual([
      { system: STRIPE_PAYMENT_ID_SYSTEM, value: 'ch_1' },
      { system: STRIPE_PAYMENT_ID_SYSTEM, value: 'pi_1' },
      { system: EHR_PATIENT_PAYMENT_ID_SYSTEM, value: DEDUP_VALUE },
    ]);
    expect(merged.extension).toContainEqual(refunds);
    expect(merged.payee).toEqual({ reference: 'Organization/stripe-org' });
    expect(merged.extension?.filter((ext) => ext.url === stripeAccountExtension(undefined).url)).toEqual([
      stripeAccountExtension('acct_1'),
    ]);
    expect(getPaymentNoticeSubmitterRef(merged)).toEqual({ reference: 'Practitioner/pr-1', display: 'Front Desk' });
    expect(clinicalCreate.mock.calls[0][0].focus.reference).toBe('PaymentNotice/pn-webhook');
    // the webhook recorded the payment; the post records its own change to it
    const [entry] = historyEntries().filter((resource) =>
      resource.target.some((target) => target.reference === 'PaymentNotice/pn-webhook')
    );
    expect(entry.activity?.coding?.[0]).toEqual(CLAIM_PROVENANCE_ACTIVITY.update);
    expect(entry.agent).toEqual([
      expect.objectContaining({ who: { reference: 'Practitioner/pr-1', display: 'Front Desk' } }),
    ]);
  });

  it('re-reads the notice and merges again when a refund was stamped after it was read', async () => {
    const webhookNotice = {
      resourceType: 'PaymentNotice',
      id: 'pn-webhook',
      meta: { versionId: '4', tag: [BILLING_RESOURCE_TAG] },
      status: 'active',
      identifier: [{ system: STRIPE_PAYMENT_ID_SYSTEM, value: 'ch_1' }],
    } as PaymentNotice;
    const refunds = buildPaymentRefundsExtension([
      { stripeRefundId: 're_1', amountInCents: 500, dateISO: '2026-04-22T16:00:00Z', status: 'succeeded' },
    ]);
    webhookStoredFirst(webhookNotice);
    billingTransaction.mockRejectedValueOnce(Object.assign(new Error('Precondition Failed'), { code: 412 }));
    billingGet.mockResolvedValueOnce({ ...webhookNotice, meta: { versionId: '5' }, extension: [refunds] });

    await invoke({
      paymentMethod: 'card',
      amountInCents: 4000,
      paymentMethodId: 'pm_1',
      idempotencyKey: IDEMPOTENCY_KEY,
    });

    expect(merges().map((request) => request.ifMatch)).toEqual(['W/"4"', 'W/"5"']);
    expect((merges()[1].resource as PaymentNotice).extension).toContainEqual(refunds);
  });

  it('rejects a card payment without a saved payment method', async () => {
    await expect(invoke({ paymentMethod: 'card', amountInCents: 4000 })).rejects.toMatchObject({
      message: expect.stringContaining('paymentMethodId'),
    });
    expect(paymentIntentsCreate).not.toHaveBeenCalled();
  });
});
