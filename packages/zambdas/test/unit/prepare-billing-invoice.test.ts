import type { APIGatewayProxyResult } from 'aws-lambda';
import { Account, Appointment, Encounter, Patient } from 'fhir/r4b';
import { PATIENT_BILLING_ACCOUNT_TYPE } from 'utils/lib/fhir/constants';
import { PrepareBillingInvoiceResponse } from 'utils/lib/types/api/invoicing.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ZambdaInput } from '../../src/shared/types/common';

const ENC_1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const { mockFlags, mockClinicalClient, mockStripe, mockGetStripeCustomerId, mockResolveTemplatePlaceholders } =
  vi.hoisted(() => ({
    mockFlags: { ottehrBillingInvoicingEnabled: true, invoicingInBillingApp: true },
    mockClinicalClient: {
      fhir: {
        search: vi.fn(),
        patch: vi.fn(),
      },
    },
    mockStripe: {
      customers: {
        create: vi.fn(),
        retrieve: vi.fn(),
      },
    },
    mockGetStripeCustomerId: vi.fn(),
    mockResolveTemplatePlaceholders: vi.fn(),
  }));

vi.mock('utils/lib/ottehr-config/feature-flags', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  FEATURE_FLAGS_CONFIG: mockFlags,
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
  getStripeCustomerIdFromAccount: (...args: unknown[]) => mockGetStripeCustomerId(...args),
}));

vi.mock('utils/lib/fhir/payments', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getStripeAccountForAppointmentOrEncounter: vi.fn().mockResolvedValue('acct_1'),
}));

type ZambdaHandler = (input: ZambdaInput) => Promise<APIGatewayProxyResult>;

let handler!: ZambdaHandler;

const encounter = {
  resourceType: 'Encounter',
  id: ENC_1,
  status: 'finished',
  class: {
    code: 'AMB',
  },
  subject: {
    reference: 'Patient/pat-1',
  },
  appointment: [
    {
      reference: 'Appointment/appt-1',
    },
  ],
} as Encounter;

const patient: Patient = {
  resourceType: 'Patient',
  id: 'pat-1',
  name: [
    {
      given: ['Katie'],
      family: 'Test',
    },
  ],
};

const account = {
  resourceType: 'Account',
  id: 'acct-fhir-1',
  status: 'active',
  type: PATIENT_BILLING_ACCOUNT_TYPE,
  subject: [
    {
      reference: 'Patient/pat-1',
    },
  ],
} as Account;

const appointment = {
  resourceType: 'Appointment',
  id: 'appt-1',
  status: 'fulfilled',
  start: '2026-07-01T13:00:00Z',
  participant: [],
} as unknown as Appointment;

const runHandler = (): Promise<APIGatewayProxyResult> =>
  handler({
    headers: null,
    body: JSON.stringify({ encounterId: ENC_1 }),
    secrets: {
      BILLING_INTEGRATION: 'ottehr',
      ENVIRONMENT: 'local',
    },
  });

describe('prepare-billing-invoice', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    mockFlags.invoicingInBillingApp = true;
    mockClinicalClient.fhir.search.mockResolvedValue({
      unbundle: () => [encounter, patient, account, appointment],
    });
    mockClinicalClient.fhir.patch.mockResolvedValue(account);
    mockGetStripeCustomerId.mockReturnValue('cus_1');
    mockStripe.customers.create.mockResolvedValue({ id: 'cus_new' });
    mockStripe.customers.retrieve.mockResolvedValue({ deleted: false, email: 'katie@example.com' });
    mockResolveTemplatePlaceholders.mockImplementation(({ overrides }) =>
      Promise.resolve({ patientFullName: 'Katie Test', ...overrides })
    );
    ({ index: handler } = (await import('../../src/ehr/prepare-billing-invoice/index')) as unknown as {
      index: ZambdaHandler;
    });
  });

  it('rejects when invoicing does not run in the billing app', async () => {
    mockFlags.invoicingInBillingApp = false;

    await expect(runHandler()).rejects.toMatchObject({ message: 'Invoicing is not enabled in the billing app' });
    expect(mockClinicalClient.fhir.search).not.toHaveBeenCalled();
  });

  it('returns the existing Stripe customer and the visit details', async () => {
    const result = await runHandler();

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body) as PrepareBillingInvoiceResponse).toEqual({
      patientId: 'pat-1',
      stripeCustomerId: 'cus_1',
      stripeAccount: 'acct_1',
      timezone: 'America/New_York',
      placeholders: {
        patientFullName: 'Katie Test',
        visitDate: '07/01/2026',
      },
    });
    expect(mockStripe.customers.retrieve).toHaveBeenCalledWith('cus_1', { stripeAccount: 'acct_1' });
    expect(mockStripe.customers.create).not.toHaveBeenCalled();
    expect(mockClinicalClient.fhir.patch).not.toHaveBeenCalled();
  });

  it('creates the Stripe customer on the clinical Account when there is none', async () => {
    mockGetStripeCustomerId.mockReturnValue(undefined);

    const result = await runHandler();

    expect(result.statusCode).toBe(200);
    expect((JSON.parse(result.body) as PrepareBillingInvoiceResponse).stripeCustomerId).toBe('cus_new');
    expect(mockStripe.customers.create).toHaveBeenCalledWith(expect.anything(), { stripeAccount: 'acct_1' });
    expect(mockClinicalClient.fhir.patch).toHaveBeenCalledWith(
      expect.objectContaining({ resourceType: 'Account', id: 'acct-fhir-1' })
    );
  });

  it('fails when the Stripe customer has no email', async () => {
    mockStripe.customers.retrieve.mockResolvedValue({ deleted: false, email: null });

    await expect(runHandler()).rejects.toThrow('must have a valid email');
  });

  it('does not pass the encounter to the placeholder lookup', async () => {
    await runHandler();

    expect(mockResolveTemplatePlaceholders).toHaveBeenCalledWith(
      expect.not.objectContaining({ encounterRef: expect.anything() })
    );
  });
});
