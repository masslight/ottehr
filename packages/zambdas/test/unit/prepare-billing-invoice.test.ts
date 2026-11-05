import type { APIGatewayProxyResult } from 'aws-lambda';
import { Account, Appointment, Encounter, Patient, Task } from 'fhir/r4b';
import { PATIENT_BILLING_ACCOUNT_TYPE, RcmTaskCodings } from 'utils/lib/fhir/constants';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ZambdaInput } from '../../src/shared/types/common';

const ENC_1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const { mockClinicalClient, mockStripe, mockResolveTemplatePlaceholders } = vi.hoisted(() => ({
  mockClinicalClient: { fhir: { search: vi.fn(), create: vi.fn() } },
  mockStripe: { customers: { retrieve: vi.fn() } },
  mockResolveTemplatePlaceholders: vi.fn(),
}));

vi.mock('utils/lib/ottehr-config/feature-flags', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  FEATURE_FLAGS_CONFIG: { ottehrBillingInvoicingEnabled: true },
}));
vi.mock('../../src/shared/auth', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('mock-token'),
}));
vi.mock('../../src/shared/helpers', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  createClinicalOystehrClient: () => mockClinicalClient,
  resolveTimezone: () => 'America/New_York',
}));
vi.mock('../../src/shared/sentry', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  wrapHandler: (_name: string, fn: (...args: unknown[]) => unknown) => fn,
}));
vi.mock('../../src/shared/stripeIntegration', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getStripeClient: () => mockStripe,
}));
vi.mock('../../src/shared/template-placeholders', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  resolveTemplatePlaceholders: (...args: unknown[]) => mockResolveTemplatePlaceholders(...args),
}));
vi.mock('utils/lib/fhir/helpers', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getStripeCustomerIdFromAccount: () => 'cus_1',
}));
vi.mock('utils/lib/fhir/payments', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getStripeAccountForAppointmentOrEncounter: vi.fn().mockResolvedValue('acct_1'),
}));

const visitResources = [
  { resourceType: 'Encounter', id: ENC_1, subject: { reference: 'Patient/pat-1' } } as Encounter,
  { resourceType: 'Patient', id: 'pat-1' } as Patient,
  {
    resourceType: 'Account',
    id: 'acct-fhir-1',
    type: PATIENT_BILLING_ACCOUNT_TYPE,
    subject: [{ reference: 'Patient/pat-1' }],
  } as Account,
  {
    resourceType: 'Appointment',
    id: 'appt-1',
    start: '2026-07-01T13:00:00Z',
    participant: [],
  } as unknown as Appointment,
];
let ehrInvoiceTasks: Task[];
let handler!: (input: ZambdaInput) => Promise<APIGatewayProxyResult>;

const runHandler = (): Promise<APIGatewayProxyResult> =>
  handler({
    headers: null,
    body: JSON.stringify({ encounterId: ENC_1 }),
    secrets: { BILLING_INTEGRATION: 'ottehr', INVOICING_IN_BILLING_APP: 'true' },
  });

describe('prepare-billing-invoice', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    ehrInvoiceTasks = [];
    mockClinicalClient.fhir.search.mockImplementation(async ({ resourceType }) => ({
      unbundle: () => (resourceType === 'Task' ? ehrInvoiceTasks : visitResources),
    }));
    mockClinicalClient.fhir.create.mockResolvedValue({});
    mockStripe.customers.retrieve.mockResolvedValue({ deleted: false, email: 'katie@example.com' });
    mockResolveTemplatePlaceholders.mockImplementation(async ({ overrides }) => ({
      patientFullName: 'Katie Test',
      ...overrides,
    }));
    ({ index: handler } = (await import('../../src/ehr/prepare-billing-invoice/index')) as unknown as {
      index: typeof handler;
    });
  });

  it('returns the Stripe customer and visit details and marks the visit for the billing app', async () => {
    const result = await runHandler();

    expect(JSON.parse(result.body)).toEqual({
      patientId: 'pat-1',
      stripeCustomerId: 'cus_1',
      stripeAccount: 'acct_1',
      timezone: 'America/New_York',
      placeholders: { patientFullName: 'Katie Test', visitDate: '07/01/2026' },
    });
    // Without the encounter, the placeholder lookup can't copy values from an older Stripe invoice.
    expect(mockResolveTemplatePlaceholders).toHaveBeenCalledWith(
      expect.not.objectContaining({ encounterRef: expect.anything() })
    );
    expect(mockClinicalClient.fhir.create).toHaveBeenCalledWith(
      expect.objectContaining({ resourceType: 'Basic', subject: { reference: `Encounter/${ENC_1}` } }),
      expect.anything()
    );
  });

  it('refuses a visit the EHR has an invoice task for before touching Stripe', async () => {
    ehrInvoiceTasks = [
      {
        resourceType: 'Task',
        status: 'completed',
        intent: 'order',
        code: RcmTaskCodings.sendInvoiceToPatient,
      },
    ];

    await expect(runHandler()).rejects.toMatchObject({
      statusCode: 409,
      message: 'This visit is invoiced from the EHR.',
    });
    // Cancelled tasks were handed to the billing app by the migrate-invoicing-to-billing script.
    expect(mockClinicalClient.fhir.search).toHaveBeenCalledWith(
      expect.objectContaining({ params: expect.arrayContaining([{ name: 'status:not', value: 'cancelled' }]) })
    );
    expect(mockStripe.customers.retrieve).not.toHaveBeenCalled();
    expect(mockClinicalClient.fhir.create).not.toHaveBeenCalled();
  });
});
