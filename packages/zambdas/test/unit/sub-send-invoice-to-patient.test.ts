import type { APIGatewayProxyResult } from 'aws-lambda';
import { Account, Appointment, Encounter, Patient, Task, TaskInput } from 'fhir/r4b';
import {
  getStripeAccountForAppointmentOrEncounter,
  getStripeCustomerIdFromAccount,
  invoiceTaskSourceTag,
  PATIENT_BILLING_ACCOUNT_TYPE,
  RcmTaskCodings,
} from 'utils';
import { ottehrCodeSystemUrl } from 'utils/lib/fhir/systemUrls';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { produceOutreachTasks } from '../../src/rcm/scheduled-outreach/producers/shared/produce-outreach-tasks';
import {
  checkOrCreateM2MClientToken,
  createClinicalOystehrClient,
  getStripeClient,
  resolveTemplatePlaceholders,
  resolveTimezone,
  sendSmsForPatient,
} from '../../src/shared';
import type { ZambdaInput } from '../../src/shared/types/common';
import { index } from '../../src/subscriptions/task/sub-send-invoice-to-patient/index';

// Shared modules (src/shared, utils, produce-outreach-tasks) are mocked suite-wide in
// vitest.unit-mocks.setup.ts; non-delegating defaults are re-established in beforeEach below.

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

type ZambdaHandler = (input: ZambdaInput) => Promise<APIGatewayProxyResult>;

const handler = index as unknown as ZambdaHandler;

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
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkOrCreateM2MClientToken).mockResolvedValue('mock-token');
    vi.mocked(createClinicalOystehrClient).mockReturnValue(mockClinicalClient as never);
    vi.mocked(getStripeClient).mockReturnValue(mockStripe as never);
    vi.mocked(sendSmsForPatient).mockResolvedValue(undefined as never);
    vi.mocked(resolveTemplatePlaceholders).mockResolvedValue({} as never);
    vi.mocked(resolveTimezone).mockReturnValue('America/New_York');
    vi.mocked(getStripeCustomerIdFromAccount).mockReturnValue('cus_1');
    vi.mocked(getStripeAccountForAppointmentOrEncounter).mockResolvedValue(undefined as never);
    vi.mocked(produceOutreachTasks).mockResolvedValue(undefined as never);
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
  });

  it('sends a billing-sourced task through Stripe without a Candid encounter id', async () => {
    const billingTask = task({
      meta: { tag: [invoiceTaskSourceTag('ottehr-billing')] },
    });

    const result = await runHandler(billingTask);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).message).toContain('sent successfully');
    expect(mockStripe.invoices.sendInvoice).toHaveBeenCalledWith('inv_1', { stripeAccount: undefined });
    expect(sendSmsForPatient).toHaveBeenCalled();
  });

  it('still rejects candid and legacy untagged tasks without a Candid encounter id', async () => {
    // The real wrapHandler turns the thrown "CandidEncounterId is not found" error into an
    // internal-error envelope rather than rejecting.
    const result = await runHandler(task());
    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toEqual({ error: 'Internal error' });

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
