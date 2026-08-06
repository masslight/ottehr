import type { APIGatewayProxyResult } from 'aws-lambda';
import { Account, Appointment, Encounter, Patient, Task, TaskInput } from 'fhir/r4b';
import { PATIENT_BILLING_ACCOUNT_TYPE, RcmTaskCodings } from 'utils/lib/fhir/constants';
import { invoiceTaskSourceTag } from 'utils/lib/types/api/invoicing.types';
import { ottehrCodeSystemUrl } from 'utils/lib/fhir/systemUrls';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ZambdaInput } from '../../src/shared/types/common';

const mockClinicalClient = {
  fhir: {
    search: vi.fn(),
    patch: vi.fn(),
  },
};
const mockStripe = {
  customers: {
    retrieve: vi.fn(),
  },
  invoices: {
    create: vi.fn(),
    finalizeInvoice: vi.fn(),
    sendInvoice: vi.fn(),
  },
  invoiceItems: {
    create: vi.fn(),
  },
};
const mockSendSmsForPatient = vi.fn();

vi.mock('../../src/shared/auth', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('mock-token'),
  };
});

vi.mock('../../src/shared/helpers', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    createClinicalOystehrClient: vi.fn(() => mockClinicalClient),
    resolveTimezone: () => 'America/New_York',
  };
});

vi.mock('../../src/shared/sentry', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    wrapHandler: (_name: string, fn: (...args: unknown[]) => unknown) => fn,
  };
});

vi.mock('../../src/shared/stripeIntegration', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    getStripeClient: () => mockStripe,
  };
});

vi.mock('../../src/shared/communication', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    sendSmsForPatient: (...args: unknown[]) => mockSendSmsForPatient(...args),
  };
});

vi.mock('../../src/shared/template-placeholders', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    resolveTemplatePlaceholders: vi.fn().mockResolvedValue({}),
  };
});

vi.mock('utils/lib/fhir/helpers', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    getStripeCustomerIdFromAccount: () => 'cus_1',
  };
});

vi.mock('utils/lib/fhir/payments', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    getStripeAccountForAppointmentOrEncounter: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('../../src/rcm/scheduled-outreach/producers/shared', () => ({
  produceOutreachTasks: vi.fn().mockResolvedValue(undefined),
}));

type ZambdaHandler = (input: ZambdaInput) => Promise<APIGatewayProxyResult>;

let handler!: ZambdaHandler;

const invoiceInput = (): TaskInput[] =>
  ['dueDate', 'smsTextMessage', 'amountCents'].map((code) => ({
    type: {
      coding: [
        {
          system: ottehrCodeSystemUrl('invoice-task-input'),
          code,
        },
      ],
    },
    valueString: code === 'amountCents' ? '5050' : code === 'dueDate' ? '2026-08-01' : 'pay your invoice',
  }));

const task = (overrides: Partial<Task> = {}): Task =>
  ({
    resourceType: 'Task',
    id: 'task-1',
    status: 'in-progress',
    intent: 'order',
    code: RcmTaskCodings.sendInvoiceToPatient,
    encounter: {
      reference: 'Encounter/enc-1',
    },
    input: invoiceInput(),
    ...overrides,
  }) as Task;

const encounter: Encounter = {
  resourceType: 'Encounter',
  id: 'enc-1',
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

const account: Account = {
  resourceType: 'Account',
  id: 'acct-1',
  status: 'active',
  type: PATIENT_BILLING_ACCOUNT_TYPE,
  subject: [
    {
      reference: 'Patient/pat-1',
    },
  ],
} as Account;

const appointment: Appointment = {
  resourceType: 'Appointment',
  id: 'appt-1',
  status: 'fulfilled',
  start: '2026-07-01T09:00:00Z',
  participant: [],
} as unknown as Appointment;

const runHandler = (invoiceTask: Task): Promise<APIGatewayProxyResult> =>
  handler({
    headers: null,
    body: JSON.stringify(invoiceTask),
    secrets: {
      PROJECT_ID: 'test-project',
      ENVIRONMENT: 'local',
    },
  });

describe('sub-send-invoice-to-patient source guard', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    mockClinicalClient.fhir.search.mockResolvedValue({
      unbundle: () => [encounter, patient, account, appointment],
    });
    mockClinicalClient.fhir.patch.mockResolvedValue({});
    mockStripe.customers.retrieve.mockResolvedValue({
      deleted: false,
      email: 'Katie@example.com',
    });
    mockStripe.invoices.create.mockResolvedValue({
      id: 'inv_1',
    });
    mockStripe.invoiceItems.create.mockResolvedValue({
      id: 'ii_1',
    });
    mockStripe.invoices.finalizeInvoice.mockResolvedValue({
      id: 'inv_1',
      status: 'open',
    });
    mockStripe.invoices.sendInvoice.mockResolvedValue({
      id: 'inv_1',
      status: 'open',
      hosted_invoice_url: 'https://invoice.example.com',
    });
    ({ index: handler } = (await import(
      '../../src/subscriptions/task/sub-send-invoice-to-patient/index'
    )) as unknown as {
      index: ZambdaHandler;
    });
  });

  it('sends a billing-sourced task through Stripe without a Candid encounter id', async () => {
    const billingTask = task({
      meta: { tag: [invoiceTaskSourceTag('ottehr-billing')] },
    });

    const result = await runHandler(billingTask);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).message).toContain('sent successfully');
    expect(mockStripe.invoices.sendInvoice).toHaveBeenCalledWith('inv_1', { stripeAccount: undefined });
    expect(mockSendSmsForPatient).toHaveBeenCalled();
  });

  it('still rejects candid and legacy untagged tasks without a Candid encounter id', async () => {
    await expect(runHandler(task())).rejects.toThrow('CandidEncounterId is not found');

    expect(mockStripe.invoices.create).not.toHaveBeenCalled();
    const patchCall = mockClinicalClient.fhir.patch.mock.calls[0][0] as {
      operations: {
        value: unknown;
      }[];
    };
    expect(patchCall.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: '/status',
          value: 'failed',
        }),
      ])
    );
  });
});
