import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Claim, PaymentNotice, Provenance } from 'fhir/r4b';
import { BILLING_RESOURCE_TAG, PAYMENT_METHOD_EXTENSION_URL } from 'utils/lib/fhir/constants';
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
  EHR_PENDING_PATIENT_PAYMENT_ID_SYSTEM,
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

  describe('card payments', () => {
    const claim = { resourceType: 'Claim', id: 'claim-1', provider: { reference: 'Organization/provider' } } as Claim;
    const encounterRequest = {
      type: 'Claim',
      identifier: { system: ottehrIdentifierSystem('claim-encounter-id'), value: ENCOUNTER_ID },
    };
    const postCard = (): Promise<APIGatewayProxyResult> =>
      invoke({ paymentMethod: 'card', amountInCents: 4000, paymentMethodId: 'pm_1', idempotencyKey: IDEMPOTENCY_KEY });
    const versionConflict = (): Error => Object.assign(new Error('Precondition Failed'), { code: 412 });
    // the notice as the webhook leaves a reservation it activated
    const activatedByWebhook = (): PaymentNotice =>
      ({
        resourceType: 'PaymentNotice',
        id: 'pn-1',
        meta: { versionId: '2', tag: [BILLING_RESOURCE_TAG] },
        status: 'active',
        request: encounterRequest,
        identifier: [
          { system: EHR_PENDING_PATIENT_PAYMENT_ID_SYSTEM, value: DEDUP_VALUE },
          { system: STRIPE_PAYMENT_ID_SYSTEM, value: 'ch_1' },
          { system: STRIPE_PAYMENT_ID_SYSTEM, value: 'pi_1' },
          { system: EHR_PATIENT_PAYMENT_ID_SYSTEM, value: DEDUP_VALUE },
        ],
      }) as PaymentNotice;

    it('reserves the payment as a draft no payment reader can find before charging the card', async () => {
      await postCard();

      const [reservation] = noticeCreates();
      expect(reservation.ifNoneExist?.[0]).toEqual({
        name: 'identifier',
        value: `${EHR_PENDING_PATIENT_PAYMENT_ID_SYSTEM}|${DEDUP_VALUE}`,
      });
      const pending = reservation.resource as PaymentNotice;
      expect(pending.status).toBe('draft');
      expect(pending.request).toBeUndefined();
      expect(pending.identifier).toEqual([{ system: EHR_PENDING_PATIENT_PAYMENT_ID_SYSTEM, value: DEDUP_VALUE }]);
      expect(getPaymentNoticeSubmitterRef(pending)).toEqual({ reference: 'Practitioner/pr-1', display: 'Front Desk' });
      // a reservation is not a payment, so nothing is recorded in claim history for it
      expect(billingTransaction.mock.calls[0][0].requests).toHaveLength(1);
      expect(billingTransaction.mock.invocationCallOrder[0]).toBeLessThan(
        paymentIntentsCreate.mock.invocationCallOrder[0]
      );
      // the charge names the reservation, so the billing webhook finds it instead of creating a notice
      expect(paymentIntentsCreate.mock.calls[0][0].metadata).toMatchObject({ oystehr_ehr_payment_id: DEDUP_VALUE });
      expect(paymentIntentsCreate.mock.calls[0][1]).toMatchObject({ idempotencyKey: IDEMPOTENCY_KEY });
    });

    it('activates the reservation in place once the charge succeeds, recording the payment', async () => {
      vi.mocked(findBillingClaimForEncounter).mockResolvedValueOnce(claim);

      const result = await postCard();

      expect(noticeCreates()).toHaveLength(1);
      const [activation] = merges();
      expect(activation.url).toBe('/PaymentNotice/pn-1');
      expect(activation.ifMatch).toBe('W/"1"');
      const notice = activation.resource as PaymentNotice;
      expect(notice.status).toBe('active');
      expect(notice.request).toEqual({ ...encounterRequest, reference: 'Claim/claim-1' });
      // the reservation identifier stays, so an overlapping replay finds the payment
      expect(notice.identifier).toEqual([
        { system: EHR_PATIENT_PAYMENT_ID_SYSTEM, value: DEDUP_VALUE },
        { system: STRIPE_PAYMENT_ID_SYSTEM, value: 'pi_1' },
        { system: STRIPE_PAYMENT_ID_SYSTEM, value: 'ch_1' },
        { system: EHR_PENDING_PATIENT_PAYMENT_ID_SYSTEM, value: DEDUP_VALUE },
      ]);
      // payee is the org behind the connected account, as the webhook resolves it
      expect(billingSearch).toHaveBeenCalledWith({
        resourceType: 'Organization',
        params: [{ name: 'identifier', value: `${STRIPE_ACCOUNT_IDENTIFIER_SYSTEM}|acct_1` }],
      });
      expect(notice.payee).toEqual({ reference: 'Organization/stripe-org' });
      expect(notice.recipient).toEqual({ reference: 'Organization/stripe-org' });
      expect(notice.extension).toContainEqual(stripeAccountExtension('acct_1'));
      const [entry] = historyEntries();
      expect(entry.activity?.coding?.[0]).toEqual(CLAIM_PROVENANCE_ACTIVITY.create);
      expect(entry.target).toEqual([{ reference: 'PaymentNotice/pn-1' }, { reference: 'Claim/claim-1' }]);
      expect(entry.agent).toEqual([
        expect.objectContaining({ who: { reference: 'Practitioner/pr-1', display: 'Front Desk' } }),
      ]);
      expect(clinicalCreate.mock.calls[0][0].focus.reference).toBe('PaymentNotice/pn-1');
      expect(JSON.parse(result.body).notice.id).toBe('pn-1');
    });

    it('keeps the notice the webhook activated first, writing nothing over it', async () => {
      billingTransaction
        .mockImplementationOnce(async ({ requests }: { requests: WriteRequest[] }) => {
          const pending = { ...requests[0].resource, id: 'pn-1', meta: { versionId: '1' } };
          return { entry: [{ resource: pending, response: { status: '201 Created' } }], unbundle: () => [pending] };
        })
        .mockRejectedValueOnce(versionConflict());
      billingGet.mockResolvedValueOnce(activatedByWebhook());

      const result = await postCard();

      // the one activation attempt lost to the webhook's; the re-read notice is already ours
      expect(merges()).toHaveLength(1);
      expect(billingGet).toHaveBeenCalledWith({ resourceType: 'PaymentNotice', id: 'pn-1' });
      expect(JSON.parse(result.body).notice.identifier).toEqual(activatedByWebhook().identifier);
      expect(clinicalCreate.mock.calls[0][0].focus.reference).toBe('PaymentNotice/pn-1');
    });

    it('resumes the reservation of the attempt a replay repeats', async () => {
      const reserved = {
        resourceType: 'PaymentNotice',
        id: 'pn-reserved',
        meta: { versionId: '3', tag: [BILLING_RESOURCE_TAG] },
        status: 'draft',
        identifier: [{ system: EHR_PENDING_PATIENT_PAYMENT_ID_SYSTEM, value: DEDUP_VALUE }],
      } as PaymentNotice;
      billingTransaction.mockImplementationOnce(async () => ({
        entry: [{ resource: reserved, response: { status: '200 OK' } }],
        unbundle: () => [reserved],
      }));

      await postCard();

      expect(merges().map((request) => [request.url, request.ifMatch])).toEqual([
        ['/PaymentNotice/pn-reserved', 'W/"3"'],
      ]);
    });

    // Regression: a replay that passed the idempotency guard while the attempt it repeats was still
    // running reserved a second draft once that attempt had activated its own, and activated it for the
    // same charge, recording the payment twice.
    it('returns the payment an overlapping replay finds already activated, without charging again', async () => {
      const recorded = activatedByWebhook();
      billingTransaction.mockImplementationOnce(async () => ({
        entry: [{ resource: recorded, response: { status: '200 OK' } }],
        unbundle: () => [recorded],
      }));

      const result = await postCard();

      expect(paymentIntentsCreate).not.toHaveBeenCalled();
      expect(merges()).toEqual([]);
      expect(historyEntries()).toEqual([]);
      expect(clinicalCreate.mock.calls[0][0].focus.reference).toBe('PaymentNotice/pn-1');
      expect(JSON.parse(result.body).notice.id).toBe('pn-1');
    });

    it('records one payment when a replay passed the idempotency guard before the first attempt finished', async () => {
      // a store answering conditional creates by identifier, as the FHIR server does once the first
      // attempt's writes have landed
      const stored = new Map<string, PaymentNotice>();
      let nextId = 0;
      const hasIdentifier = (notice: PaymentNotice, token: string): boolean =>
        (notice.identifier ?? []).some((identifier) => `${identifier.system}|${identifier.value}` === token);
      billingTransaction.mockImplementation(async ({ requests }: { requests: WriteRequest[] }) => {
        const results = requests.map((request) => {
          if (request.method === 'POST' && request.url === '/PaymentNotice') {
            const token = request.ifNoneExist?.[0]?.value ?? '';
            const match = [...stored.values()].find((notice) => hasIdentifier(notice, token));
            if (match) return { resource: match, status: '200 OK' };
            const created = {
              ...(request.resource as PaymentNotice),
              id: `pn-${++nextId}`,
              meta: { versionId: '1' },
            };
            stored.set(created.id, created);
            return { resource: created, status: '201 Created' };
          }
          if (request.method === 'PUT') {
            const updated = request.resource as PaymentNotice;
            stored.set(updated.id!, updated);
          }
          return { resource: request.resource, status: '200 OK' };
        });
        return {
          entry: results.map(({ resource, status }) => ({ resource, response: { status } })),
          unbundle: () => results.map(({ resource }) => resource),
        };
      });

      // the second request's guard search ran before the first activated the payment, so it found nothing
      const first = await postCard();
      const second = await postCard();

      expect(paymentIntentsCreate).toHaveBeenCalledTimes(1);
      expect(stored.size).toBe(1);
      expect(JSON.parse(second.body).notice.id).toBe(JSON.parse(first.body).notice.id);
    });

    it('links an activated notice through reconcile when the claim appeared after the charge', async () => {
      vi.mocked(findBillingClaimForEncounter).mockResolvedValueOnce(undefined).mockResolvedValueOnce(claim);
      const linked = { ...activatedByWebhook(), request: { ...encounterRequest, reference: 'Claim/claim-1' } };
      billingGet.mockResolvedValueOnce(linked);

      const result = await postCard();

      expect(mergedNotice().request).toEqual(encounterRequest);
      expect(reconcilePaymentNoticesForClaim).toHaveBeenCalledWith(expect.anything(), claim);
      expect(JSON.parse(result.body).notice.request.reference).toBe('Claim/claim-1');
    });

    it('cancels the reservation when the charge fails, recording no payment', async () => {
      paymentIntentsCreate.mockRejectedValueOnce(
        Object.assign(new Error('Your card was declined.'), { type: 'StripeCardError', code: 'card_declined' })
      );

      await expect(postCard()).rejects.toBeDefined();

      const [cancellation] = merges();
      expect(cancellation.url).toBe('/PaymentNotice/pn-1');
      expect(cancellation.ifMatch).toBe('W/"1"');
      const cancelled = cancellation.resource as PaymentNotice;
      expect(cancelled.status).toBe('cancelled');
      expect(cancelled.identifier).toEqual([{ system: EHR_PENDING_PATIENT_PAYMENT_ID_SYSTEM, value: DEDUP_VALUE }]);
      expect(historyEntries()).toEqual([]);
      expect(clinicalCreate).not.toHaveBeenCalled();
    });

    it('keeps a reservation the webhook activated while the charge reported a failure', async () => {
      paymentIntentsCreate.mockResolvedValueOnce({ id: 'pi_1', status: 'processing', latest_charge: 'ch_1' });
      billingTransaction
        .mockImplementationOnce(async ({ requests }: { requests: WriteRequest[] }) => {
          const pending = { ...requests[0].resource, id: 'pn-1', meta: { versionId: '1' } };
          return { entry: [{ resource: pending, response: { status: '201 Created' } }], unbundle: () => [pending] };
        })
        .mockRejectedValueOnce(versionConflict());
      billingGet.mockResolvedValueOnce(activatedByWebhook());

      await expect(postCard()).rejects.toBeDefined();

      // the cancellation lost to the activation and was not retried over it
      expect(merges()).toHaveLength(1);
    });
  });

  it('rejects a card payment without a saved payment method', async () => {
    await expect(invoke({ paymentMethod: 'card', amountInCents: 4000 })).rejects.toMatchObject({
      message: expect.stringContaining('paymentMethodId'),
    });
    expect(paymentIntentsCreate).not.toHaveBeenCalled();
  });
});
