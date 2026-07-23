import { Encounter, PaymentNotice, Task } from 'fhir/r4b';
import { PAYMENT_METHOD_EXTENSION_URL, Secrets } from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPerformCandidPreEncounterSync = vi.fn();
const mockCreatePatientPaymentReceiptPdf = vi.fn();
const mockRecordBillingPatientPayment = vi.fn();
const mockPatchTaskStatus = vi.fn();
const mockCreateClinicalOystehrClient = vi.fn();
const mockGetStripeClient = vi.fn();

const mockFhirSearch = vi.fn();
const mockOystehrClient = { fhir: { search: mockFhirSearch } };
const mockStripeClient = { paymentIntents: { retrieve: vi.fn() } };

vi.mock('../../../src/shared', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  performCandidPreEncounterSync: mockPerformCandidPreEncounterSync,
  createPatientPaymentReceiptPdf: mockCreatePatientPaymentReceiptPdf,
  getAuth0Token: vi.fn().mockResolvedValue('test-token'),
  createClinicalOystehrClient: mockCreateClinicalOystehrClient,
  getStripeClient: mockGetStripeClient,
  wrapHandler: (_name: string, handler: unknown) => handler,
}));

vi.mock('../../../src/billing/payments', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  recordBillingPatientPayment: mockRecordBillingPatientPayment,
}));

vi.mock('../../../src/billing/shared', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  createBillingClient: vi.fn().mockReturnValue({}),
}));

vi.mock('utils', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getStripeAccountForAppointmentOrEncounter: vi.fn().mockResolvedValue('acct_test'),
  getOrCreateCandidApiClient: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../../src/subscriptions/helpers', () => ({
  patchTaskStatus: (...args: unknown[]) => mockPatchTaskStatus(...args),
}));

vi.mock('../../../src/subscriptions/task/validateRequestParameters', () => ({
  validateRequestParameters: vi.fn(),
}));

vi.mock('@sentry/aws-serverless', () => ({
  captureException: vi.fn(),
}));

const { validateRequestParameters } = await import('../../../src/subscriptions/task/validateRequestParameters');
const { CLINICAL_PAYMENT_NOTICE_ID_SYSTEM } = await import('../../../src/billing/payments');
const { index: _index } = await import(
  '../../../src/subscriptions/task/sub-patient-payment-candid-sync-and-receipt/index'
);
const index = _index as unknown as (input: unknown) => Promise<{ statusCode: number; body: string }>;

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

describe('sub-patient-payment-candid-sync-and-receipt: Ottehr billing record', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClinicalOystehrClient.mockReturnValue(mockOystehrClient);
    mockGetStripeClient.mockReturnValue(mockStripeClient);
    mockPerformCandidPreEncounterSync.mockResolvedValue(undefined);
    mockCreatePatientPaymentReceiptPdf.mockResolvedValue({ url: 'https://example.com/receipt.pdf' });
    mockRecordBillingPatientPayment.mockResolvedValue({ notice: { id: 'billing-pn-1' } });
    mockPatchTaskStatus.mockResolvedValue({ status: 'completed', statusReason: { text: 'success' } });
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

    const result = await index({ headers: {}, body: '{}', secrets: {} });

    expect(result.statusCode).toBe(200);
    expect(mockRecordBillingPatientPayment).toHaveBeenCalledTimes(1);
    expect(mockRecordBillingPatientPayment.mock.calls[0][1]).toMatchObject({
      encounterId: 'enc-1',
      amountInCents: 2500,
      paymentMethod: 'cash',
      dedupIdentifier: { system: CLINICAL_PAYMENT_NOTICE_ID_SYSTEM, value: 'pn-1' },
      paymentDate: '2026-04-22',
      createdISO: '2026-04-22T15:30:00Z',
      description: 'cash collected from patient',
      submitterRef: { reference: 'Practitioner/front-desk' },
    });
    expect(mockPerformCandidPreEncounterSync).not.toHaveBeenCalled();
    expect(mockPatchTaskStatus).toHaveBeenCalledWith(
      expect.objectContaining({ taskStatusToUpdate: 'completed' }),
      expect.anything()
    );
  });

  it("runs billing before candid under 'all'", async () => {
    const notice = makePaymentNotice({ id: 'pn-2', amountDollars: 10, encounterId: 'enc-2' });
    setup(notice, 'enc-2', 'all');

    await index({ headers: {}, body: '{}', secrets: {} });

    expect(mockRecordBillingPatientPayment).toHaveBeenCalledTimes(1);
    expect(mockPerformCandidPreEncounterSync).toHaveBeenCalledTimes(1);
    expect(mockRecordBillingPatientPayment.mock.invocationCallOrder[0]).toBeLessThan(
      mockPerformCandidPreEncounterSync.mock.invocationCallOrder[0]
    );
  });

  it("does not record in billing when BILLING_INTEGRATION is 'candid'", async () => {
    const notice = makePaymentNotice({ id: 'pn-3', amountDollars: 10, encounterId: 'enc-3' });
    setup(notice, 'enc-3', 'candid');

    await index({ headers: {}, body: '{}', secrets: {} });

    expect(mockRecordBillingPatientPayment).not.toHaveBeenCalled();
    expect(mockPerformCandidPreEncounterSync).toHaveBeenCalledTimes(1);
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

    await index({ headers: {}, body: '{}', secrets: {} });

    expect(mockRecordBillingPatientPayment).not.toHaveBeenCalled();
    expect(mockPerformCandidPreEncounterSync).toHaveBeenCalledWith(expect.objectContaining({ amountCents: undefined }));
  });

  it('skips candid and fails the task when the billing record fails, receipt still runs', async () => {
    const notice = makePaymentNotice({ id: 'pn-5', amountDollars: 20, encounterId: 'enc-5' });
    setup(notice, 'enc-5', 'all');
    mockRecordBillingPatientPayment.mockRejectedValue(new Error('billing store down'));

    const result = await index({ headers: {}, body: '{}', secrets: {} });

    expect(result.statusCode).toBe(200);
    expect(mockPerformCandidPreEncounterSync).not.toHaveBeenCalled();
    expect(mockCreatePatientPaymentReceiptPdf).toHaveBeenCalledTimes(1);
    const patch = mockPatchTaskStatus.mock.calls[0][0];
    expect(patch.taskStatusToUpdate).toBe('failed');
    expect(patch.statusReasonToUpdate).toContain('Ottehr billing payment record failed');
    expect(patch.statusReasonToUpdate).toContain('Candid sync skipped');
  });

  it('fails the whole task when the notice references a different encounter than the task', async () => {
    const notice = makePaymentNotice({ id: 'pn-7', amountDollars: 10, encounterId: 'enc-other' });
    setup(notice, 'enc-7', 'ottehr');

    await expect(index({ headers: {}, body: '{}', secrets: {} })).rejects.toThrow('expected Encounter/enc-7');
    expect(mockRecordBillingPatientPayment).not.toHaveBeenCalled();
    expect(mockPatchTaskStatus).toHaveBeenCalledWith(
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

    const result = await index({ headers: {}, body: '{}', secrets: {} });

    expect(result.statusCode).toBe(200);
    expect(mockRecordBillingPatientPayment).not.toHaveBeenCalled();
    const patch = mockPatchTaskStatus.mock.calls[0][0];
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

    await index({ headers: {}, body: '{}', secrets: {} });

    expect(mockRecordBillingPatientPayment.mock.calls[0][1]).toMatchObject({
      paymentDate: '2026-04-22',
      description: undefined,
      submitterRef: undefined,
    });
  });
});
