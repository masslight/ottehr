import { Encounter, PaymentNotice } from 'fhir/r4b';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockPerformCandidPreEncounterSync = vi.fn();
const mockCreatePatientPaymentReceiptPdf = vi.fn();
const mockGetAuth0Token = vi.fn().mockResolvedValue('test-token');
const mockCreateOystehrClient = vi.fn();
const mockGetStripeClient = vi.fn();
const mockPatchTaskStatus = vi.fn();

const mockFhirSearch = vi.fn();
const mockFhirGet = vi.fn();
const mockFhirCreate = vi.fn();
const mockFhirPatch = vi.fn();

const mockOystehrClient = {
  fhir: {
    search: mockFhirSearch,
    get: mockFhirGet,
    create: mockFhirCreate,
    patch: mockFhirPatch,
  },
};

const mockStripeClient = {
  paymentIntents: {
    retrieve: vi.fn(),
  },
};

vi.mock('../../src/shared', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    performCandidPreEncounterSync: mockPerformCandidPreEncounterSync,
    createPatientPaymentReceiptPdf: mockCreatePatientPaymentReceiptPdf,
    getAuth0Token: mockGetAuth0Token,
    createOystehrClient: mockCreateOystehrClient,
    getStripeClient: mockGetStripeClient,
    wrapHandler: (_name: string, handler: any) => handler,
    STRIPE_PAYMENT_ID_SYSTEM: 'https://fhir.oystehr.com/PaymentIdSystem/stripe',
  };
});

vi.mock('utils', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    getStripeAccountForAppointmentOrEncounter: vi.fn().mockResolvedValue('acct_test'),
    getOptionalSecret: vi.fn().mockReturnValue('candid-client-id-value'),
    // tests don't drive real candid traffic, so any non-empty string is fine
    getSecret: vi.fn().mockReturnValue('test-value'),
    // stub to avoid reading the unmocked secret, skipping performCandidPreEncounterSync
    getOrCreateCandidApiClient: vi.fn().mockResolvedValue({}),
  };
});

vi.mock('../../src/subscriptions/helpers', () => ({
  patchTaskStatus: (...args: any[]) => mockPatchTaskStatus(...args),
}));

vi.mock('../../src/subscriptions/task/validateRequestParameters', () => ({
  validateRequestParameters: vi.fn(),
}));

vi.mock('@sentry/aws-serverless', () => ({
  captureException: vi.fn(),
}));

// ── Imports (after mocks) ──────────────────────────────────────────────────────

const { validateRequestParameters } = await import('../../src/subscriptions/task/validateRequestParameters');

// The mock for wrapHandler makes `index` a plain async function (input) => result
// so we cast to the simplified signature for test ergonomics.
const { index: _index } = await import(
  '../../src/subscriptions/task/sub-patient-payment-candid-sync-and-receipt/index'
);
const index = _index as unknown as (input: any) => Promise<{ statusCode: number; body: string }>;

// ── Fixtures ───────────────────────────────────────────────────────────────────

const STRIPE_PAYMENT_ID_SYSTEM = 'https://fhir.oystehr.com/PaymentIdSystem/stripe';

const makePaymentNotice = (opts: {
  id: string;
  amountDollars: number;
  encounterId: string;
  stripePaymentIntentId?: string;
}): PaymentNotice => ({
  resourceType: 'PaymentNotice',
  id: opts.id,
  status: 'active',
  payment: { reference: 'PaymentReconciliation/test' },
  created: '2026-04-22',
  recipient: { reference: 'Organization/org-1' },
  amount: { value: opts.amountDollars, currency: 'USD' },
  request: { reference: `Encounter/${opts.encounterId}` },
  identifier: opts.stripePaymentIntentId
    ? [{ system: STRIPE_PAYMENT_ID_SYSTEM, value: opts.stripePaymentIntentId }]
    : [],
});

const makeEncounter = (id: string, patientId: string): Encounter => ({
  resourceType: 'Encounter',
  id,
  status: 'finished',
  class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB' },
  subject: { reference: `Patient/${patientId}` },
});

// ── Stripe payment skip logic (subscription zambda) ────────────────────────────

describe('sub-patient-payment-candid-sync-and-receipt: Stripe payment skip logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateOystehrClient.mockReturnValue(mockOystehrClient);
    mockGetStripeClient.mockReturnValue(mockStripeClient);
    mockPerformCandidPreEncounterSync.mockResolvedValue(undefined);
    mockCreatePatientPaymentReceiptPdf.mockResolvedValue({ url: 'https://example.com/receipt.pdf' });
    mockPatchTaskStatus.mockResolvedValue({ status: 'completed', statusReason: { text: 'success' } });
  });

  function setupValidatedParams(taskId: string, paymentNoticeId: string, encounterId: string): void {
    vi.mocked(validateRequestParameters).mockReturnValue({
      task: {
        id: taskId,
        resourceType: 'Task',
        status: 'requested',
        intent: 'order',
        focus: {
          type: 'PaymentNotice',
          reference: `PaymentNotice/${paymentNoticeId}`,
        },
        encounter: {
          reference: `Encounter/${encounterId}`,
        },
      },
      secrets: {} as any,
    } as any);
  }

  function setupFhirSearches(paymentNotice: PaymentNotice, encounter: Encounter): void {
    mockFhirSearch.mockImplementation(async ({ resourceType }: { resourceType: string }) => {
      if (resourceType === 'PaymentNotice') {
        return { unbundle: () => [paymentNotice] };
      }
      if (resourceType === 'Encounter') {
        return { unbundle: () => [encounter] };
      }
      return { unbundle: () => [] };
    });
  }

  it('passes amountCents to Candid sync for cash payments (no Stripe identifier)', async () => {
    const paymentNotice = makePaymentNotice({
      id: 'pn-cash-1',
      amountDollars: 25,
      encounterId: 'enc-100',
    });
    const encounter = makeEncounter('enc-100', 'patient-100');

    setupValidatedParams('task-1', 'pn-cash-1', 'enc-100');
    setupFhirSearches(paymentNotice, encounter);

    const result = await index({ headers: {}, body: '{}', secrets: {} });

    expect(result.statusCode).toBe(200);
    expect(mockPerformCandidPreEncounterSync).toHaveBeenCalledWith(
      expect.objectContaining({
        encounterId: 'enc-100',
        amountCents: 2500, // $25.00 = 2500 cents
      })
    );
  });

  it('passes undefined amountCents to Candid sync for Stripe card payments', async () => {
    const paymentNotice = makePaymentNotice({
      id: 'pn-stripe-1',
      amountDollars: 30,
      encounterId: 'enc-200',
      stripePaymentIntentId: 'pi_test_stripe_123',
    });
    const encounter = makeEncounter('enc-200', 'patient-200');

    setupValidatedParams('task-2', 'pn-stripe-1', 'enc-200');
    setupFhirSearches(paymentNotice, encounter);
    mockStripeClient.paymentIntents.retrieve.mockResolvedValue({ id: 'pi_test_stripe_123', status: 'succeeded' });

    const result = await index({ headers: {}, body: '{}', secrets: {} });

    expect(result.statusCode).toBe(200);
    expect(mockPerformCandidPreEncounterSync).toHaveBeenCalledWith(
      expect.objectContaining({
        encounterId: 'enc-200',
        amountCents: undefined, // Stripe payment → do NOT record in Candid
      })
    );
  });

  it('still performs Candid pre-encounter sync (patient/appointment) for Stripe payments', async () => {
    const paymentNotice = makePaymentNotice({
      id: 'pn-stripe-2',
      amountDollars: 50,
      encounterId: 'enc-300',
      stripePaymentIntentId: 'pi_test_stripe_456',
    });
    const encounter = makeEncounter('enc-300', 'patient-300');

    setupValidatedParams('task-3', 'pn-stripe-2', 'enc-300');
    setupFhirSearches(paymentNotice, encounter);
    mockStripeClient.paymentIntents.retrieve.mockResolvedValue({ id: 'pi_test_stripe_456', status: 'succeeded' });

    await index({ headers: {}, body: '{}', secrets: {} });

    // Sync is always called, even for Stripe — only the payment amount is skipped
    expect(mockPerformCandidPreEncounterSync).toHaveBeenCalledTimes(1);
    expect(mockPerformCandidPreEncounterSync).toHaveBeenCalledWith(
      expect.objectContaining({
        encounterId: 'enc-300',
        candidApiClient: expect.anything(),
      })
    );
  });

  it('passes amountCents to Candid sync for check payments (no Stripe identifier)', async () => {
    const paymentNotice = makePaymentNotice({
      id: 'pn-check-1',
      amountDollars: 15,
      encounterId: 'enc-400',
    });
    const encounter = makeEncounter('enc-400', 'patient-400');

    setupValidatedParams('task-4', 'pn-check-1', 'enc-400');
    setupFhirSearches(paymentNotice, encounter);

    const result = await index({ headers: {}, body: '{}', secrets: {} });

    expect(result.statusCode).toBe(200);
    expect(mockPerformCandidPreEncounterSync).toHaveBeenCalledWith(
      expect.objectContaining({
        amountCents: 1500, // $15.00 = 1500 cents
      })
    );
  });

  it('passes undefined amountCents for Stripe terminal (card-reader) payments', async () => {
    const paymentNotice = makePaymentNotice({
      id: 'pn-terminal-1',
      amountDollars: 40,
      encounterId: 'enc-500',
      stripePaymentIntentId: 'pi_terminal_789', // Terminal payments also have Stripe PI
    });
    const encounter = makeEncounter('enc-500', 'patient-500');

    setupValidatedParams('task-5', 'pn-terminal-1', 'enc-500');
    setupFhirSearches(paymentNotice, encounter);
    mockStripeClient.paymentIntents.retrieve.mockResolvedValue({ id: 'pi_terminal_789', status: 'succeeded' });

    const result = await index({ headers: {}, body: '{}', secrets: {} });

    expect(result.statusCode).toBe(200);
    expect(mockPerformCandidPreEncounterSync).toHaveBeenCalledWith(
      expect.objectContaining({
        amountCents: undefined, // Terminal/card-reader payment → skip Candid
      })
    );
  });

  it('handles Candid sync failure gracefully and marks task as failed', async () => {
    const paymentNotice = makePaymentNotice({
      id: 'pn-fail-1',
      amountDollars: 10,
      encounterId: 'enc-600',
    });
    const encounter = makeEncounter('enc-600', 'patient-600');

    setupValidatedParams('task-6', 'pn-fail-1', 'enc-600');
    setupFhirSearches(paymentNotice, encounter);
    mockPerformCandidPreEncounterSync.mockRejectedValue(new Error('Candid API down'));
    mockPatchTaskStatus.mockResolvedValue({ status: 'failed', statusReason: { text: 'Candid sync failed' } });

    const result = await index({ headers: {}, body: '{}', secrets: {} });

    expect(result.statusCode).toBe(200);
    expect(mockPatchTaskStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        taskStatusToUpdate: 'failed',
      }),
      expect.anything()
    );
  });

  it('correctly calculates amountInCents from PaymentNotice amount', async () => {
    const paymentNotice = makePaymentNotice({
      id: 'pn-cents-1',
      amountDollars: 12.99, // $12.99
      encounterId: 'enc-700',
    });
    const encounter = makeEncounter('enc-700', 'patient-700');

    setupValidatedParams('task-7', 'pn-cents-1', 'enc-700');
    setupFhirSearches(paymentNotice, encounter);

    await index({ headers: {}, body: '{}', secrets: {} });

    expect(mockPerformCandidPreEncounterSync).toHaveBeenCalledWith(
      expect.objectContaining({
        amountCents: 1299,
      })
    );
  });

  it('handles $0 payment notice amount (amountCents = 0)', async () => {
    const paymentNotice = makePaymentNotice({
      id: 'pn-zero-1',
      amountDollars: 0,
      encounterId: 'enc-800',
    });
    const encounter = makeEncounter('enc-800', 'patient-800');

    setupValidatedParams('task-8', 'pn-zero-1', 'enc-800');
    setupFhirSearches(paymentNotice, encounter);

    await index({ headers: {}, body: '{}', secrets: {} });

    // $0 cash payment → amountCents = 0, still passed (performCandidPreEncounterSync handles falsy check)
    expect(mockPerformCandidPreEncounterSync).toHaveBeenCalledWith(
      expect.objectContaining({
        amountCents: 0,
      })
    );
  });
});
