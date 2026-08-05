import { Encounter, PaymentNotice, Task } from 'fhir/r4b';
import {
  getOrCreateCandidApiClient,
  getStripeAccountForAppointmentOrEncounter,
  PAYMENT_METHOD_EXTENSION_URL,
  Secrets,
} from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CLINICAL_PAYMENT_NOTICE_ID_SYSTEM, recordBillingPatientPayment } from '../../../src/billing/payments';
import { createBillingClient } from '../../../src/billing/shared';
import {
  createClinicalOystehrClient,
  createPatientPaymentReceiptPdf,
  getAuth0Token,
  getStripeClient,
  performCandidPreEncounterSync,
} from '../../../src/shared';
import { patchTaskStatus } from '../../../src/subscriptions/helpers';
import { index as _index } from '../../../src/subscriptions/task/sub-patient-payment-candid-sync-and-receipt/index';
import { validateRequestParameters } from '../../../src/subscriptions/task/validateRequestParameters';

// All shared-module mocks (src/shared, src/billing/*, src/subscriptions/*, utils, @sentry) are
// registered suite-wide in vitest.unit-mocks.setup.ts; per-test behavior is installed below
// via vi.mocked(...).

const index = _index as unknown as (input: unknown) => Promise<{ statusCode: number; body: string }>;

const mockFhirSearch = vi.fn();
const mockOystehrClient = { fhir: { search: mockFhirSearch } };
const mockStripeClient = { paymentIntents: { retrieve: vi.fn() } };

const STRIPE_PAYMENT_ID_SYSTEM = 'https://fhir.oystehr.com/PaymentIdSystem/stripe';

const makePaymentNotice = (opts: {
  id: string;
  amountDollars: number;
  encounterId: string;
  stripePaymentIntentId?: string;
  method?: string;
  status?: PaymentNotice['status'];
  currency?: string;
  created?: string;
  withReconciliation?: boolean;
}): PaymentNotice => ({
  resourceType: 'PaymentNotice',
  id: opts.id,
  status: opts.status ?? 'active',
  payment: { reference: '#contained-reconciliation' },
  created: opts.created ?? '2026-04-22T15:30:00Z',
  recipient: { reference: 'Organization/org-1' },
  amount: { value: opts.amountDollars, currency: opts.currency ?? 'USD' },
  request: { reference: `Encounter/${opts.encounterId}` },
  extension: [{ url: PAYMENT_METHOD_EXTENSION_URL, valueString: opts.method ?? 'cash' }],
  contained:
    opts.withReconciliation === false
      ? undefined
      : [
          {
            resourceType: 'PaymentReconciliation',
            id: 'contained-reconciliation',
            status: 'active',
            created: '2026-04-22T15:30:00Z',
            paymentDate: '2026-04-22',
            paymentAmount: { value: opts.amountDollars, currency: 'USD' },
            disposition: `${opts.method ?? 'cash'} collected from patient`,
            detail: [{ type: {}, submitter: { reference: 'Practitioner/front-desk' } }],
          },
        ],
  identifier: opts.stripePaymentIntentId
    ? [{ system: STRIPE_PAYMENT_ID_SYSTEM, value: opts.stripePaymentIntentId }]
    : [],
});

const makeEncounter = (id: string): Encounter => ({
  resourceType: 'Encounter',
  id,
  status: 'finished',
  class: { code: 'AMB' },
  subject: { reference: 'Patient/patient-1' },
});

function setupValidatedParams(paymentNoticeId: string, encounterId: string, secrets: Secrets): void {
  const task: Task = {
    id: 'task-1',
    resourceType: 'Task',
    status: 'requested',
    intent: 'order',
    focus: { type: 'PaymentNotice', reference: `PaymentNotice/${paymentNoticeId}` },
    encounter: { reference: `Encounter/${encounterId}` },
  };
  vi.mocked(validateRequestParameters).mockReturnValue({
    task,
    secrets,
  });
}

function setupFhirSearches(paymentNotice: PaymentNotice, encounter: Encounter): void {
  mockFhirSearch.mockImplementation(async ({ resourceType }: { resourceType: string }) => {
    if (resourceType === 'PaymentNotice') return { unbundle: () => [paymentNotice] };
    if (resourceType === 'Encounter') return { unbundle: () => [encounter] };
    return { unbundle: () => [] };
  });
}

// The real wrapHandler applies suite-wide; it reads the ENVIRONMENT secret from the
// invocation input ('local' keeps error reporting inert).
const zambdaInput = { headers: {}, body: '{}', secrets: { ENVIRONMENT: 'local' } };

describe('sub-patient-payment-candid-sync-and-receipt: Ottehr billing record', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAuth0Token).mockResolvedValue('test-token');
    vi.mocked(createClinicalOystehrClient).mockReturnValue(mockOystehrClient as never);
    vi.mocked(getStripeClient).mockReturnValue(mockStripeClient as never);
    vi.mocked(performCandidPreEncounterSync).mockResolvedValue(undefined);
    vi.mocked(createPatientPaymentReceiptPdf).mockResolvedValue({ url: 'https://example.com/receipt.pdf' } as never);
    vi.mocked(recordBillingPatientPayment).mockResolvedValue({ notice: { id: 'billing-pn-1' } } as never);
    vi.mocked(patchTaskStatus).mockResolvedValue({ status: 'completed', statusReason: { text: 'success' } } as never);
    vi.mocked(createBillingClient).mockReturnValue({} as never);
    vi.mocked(getStripeAccountForAppointmentOrEncounter).mockResolvedValue('acct_test');
    vi.mocked(getOrCreateCandidApiClient).mockResolvedValue({} as never);
  });

  function setup(notice: PaymentNotice, encounterId: string, billingIntegration?: string): void {
    setupValidatedParams(notice.id!, encounterId, {
      ...(billingIntegration ? { BILLING_INTEGRATION: billingIntegration } : {}),
    });
    setupFhirSearches(notice, makeEncounter(encounterId));
  }

  it("records the payment with data copied from the clinical notice when BILLING_INTEGRATION is 'ottehr'", async () => {
    const notice = makePaymentNotice({ id: 'pn-1', amountDollars: 25, encounterId: 'enc-1' });
    setup(notice, 'enc-1', 'ottehr');

    const result = await index(zambdaInput);

    expect(result.statusCode).toBe(200);
    expect(recordBillingPatientPayment).toHaveBeenCalledTimes(1);
    expect(vi.mocked(recordBillingPatientPayment).mock.calls[0][1]).toMatchObject({
      encounterId: 'enc-1',
      amountInCents: 2500,
      paymentMethod: 'cash',
      dedupIdentifier: { system: CLINICAL_PAYMENT_NOTICE_ID_SYSTEM, value: 'pn-1' },
      paymentDate: '2026-04-22',
      createdISO: '2026-04-22T15:30:00Z',
      description: 'cash collected from patient',
      submitterRef: { reference: 'Practitioner/front-desk' },
    });
    expect(performCandidPreEncounterSync).not.toHaveBeenCalled();
    expect(patchTaskStatus).toHaveBeenCalledWith(
      expect.objectContaining({ taskStatusToUpdate: 'completed' }),
      expect.anything()
    );
  });

  it("runs billing before candid under 'all'", async () => {
    const notice = makePaymentNotice({ id: 'pn-2', amountDollars: 10, encounterId: 'enc-2' });
    setup(notice, 'enc-2', 'all');

    await index(zambdaInput);

    expect(recordBillingPatientPayment).toHaveBeenCalledTimes(1);
    expect(performCandidPreEncounterSync).toHaveBeenCalledTimes(1);
    expect(vi.mocked(recordBillingPatientPayment).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(performCandidPreEncounterSync).mock.invocationCallOrder[0]
    );
  });

  it("does not record in billing when BILLING_INTEGRATION is 'candid'", async () => {
    const notice = makePaymentNotice({ id: 'pn-3', amountDollars: 10, encounterId: 'enc-3' });
    setup(notice, 'enc-3', 'candid');

    await index(zambdaInput);

    expect(recordBillingPatientPayment).not.toHaveBeenCalled();
    expect(performCandidPreEncounterSync).toHaveBeenCalledTimes(1);
  });

  it('skips billing for Stripe-identified notices', async () => {
    const notice = makePaymentNotice({
      id: 'pn-4',
      amountDollars: 30,
      encounterId: 'enc-4',
      stripePaymentIntentId: 'pi_123',
      method: 'card',
    });
    setup(notice, 'enc-4', 'all');
    mockStripeClient.paymentIntents.retrieve.mockResolvedValue({ id: 'pi_123', status: 'succeeded' });

    await index(zambdaInput);

    expect(recordBillingPatientPayment).not.toHaveBeenCalled();
    expect(performCandidPreEncounterSync).toHaveBeenCalledWith(expect.objectContaining({ amountCents: undefined }));
  });

  it('skips candid and fails the task when the billing record fails, receipt still runs', async () => {
    const notice = makePaymentNotice({ id: 'pn-5', amountDollars: 20, encounterId: 'enc-5' });
    setup(notice, 'enc-5', 'all');
    vi.mocked(recordBillingPatientPayment).mockRejectedValue(new Error('billing store down'));

    const result = await index(zambdaInput);

    expect(result.statusCode).toBe(200);
    expect(performCandidPreEncounterSync).not.toHaveBeenCalled();
    expect(createPatientPaymentReceiptPdf).toHaveBeenCalledTimes(1);
    const patch = vi.mocked(patchTaskStatus).mock.calls[0][0];
    expect(patch.taskStatusToUpdate).toBe('failed');
    expect(patch.statusReasonToUpdate).toContain('Ottehr billing payment record failed');
    expect(patch.statusReasonToUpdate).toContain('Candid sync skipped');
  });

  it('fails the whole task when the notice references a different encounter than the task', async () => {
    const notice = makePaymentNotice({ id: 'pn-7', amountDollars: 10, encounterId: 'enc-other' });
    setup(notice, 'enc-7', 'ottehr');

    // The real wrapHandler turns the thrown "references ..., expected Encounter/enc-7" error into
    // a structured 500 response instead of rejecting.
    const result = await index(zambdaInput);

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toEqual({ error: 'Internal error' });
    expect(recordBillingPatientPayment).not.toHaveBeenCalled();
    expect(patchTaskStatus).toHaveBeenCalledWith(
      expect.objectContaining({ taskStatusToUpdate: 'failed' }),
      expect.anything()
    );
  });

  const invalidNotices = [
    { name: 'a cancelled notice', override: { status: 'cancelled' as const }, reason: 'expected active' },
    { name: 'a non-USD notice', override: { currency: 'EUR' }, reason: 'unexpected currency' },
    { name: 'an invalid created timestamp', override: { created: 'not-a-date' }, reason: 'invalid created timestamp' },
  ];

  it.each(invalidNotices)('fails the billing step for $name', async ({ override, reason }) => {
    const notice = makePaymentNotice({ id: 'pn-8', amountDollars: 10, encounterId: 'enc-8', ...override });
    setup(notice, 'enc-8', 'ottehr');

    const result = await index(zambdaInput);

    expect(result.statusCode).toBe(200);
    expect(recordBillingPatientPayment).not.toHaveBeenCalled();
    const patch = vi.mocked(patchTaskStatus).mock.calls[0][0];
    expect(patch.taskStatusToUpdate).toBe('failed');
    expect(patch.statusReasonToUpdate).toContain(reason);
  });

  it('falls back to the Eastern date of created when the notice has no contained reconciliation', async () => {
    const notice = makePaymentNotice({
      id: 'pn-9',
      amountDollars: 10,
      encounterId: 'enc-9',
      withReconciliation: false,
    });
    setup(notice, 'enc-9', 'ottehr');

    await index(zambdaInput);

    expect(vi.mocked(recordBillingPatientPayment).mock.calls[0][1]).toMatchObject({
      paymentDate: '2026-04-22',
      description: undefined,
      submitterRef: undefined,
    });
  });
});
