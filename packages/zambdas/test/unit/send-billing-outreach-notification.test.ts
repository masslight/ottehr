import type { APIGatewayProxyResult } from 'aws-lambda';
import { Encounter, Patient, Task } from 'fhir/r4b';
import { TaskIndicator } from 'utils/lib/types/common';
import { APIErrorCode } from 'utils/lib/types/errors';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BILLING_APP_INVOICE_STATEMENT_INPUT,
  isBillingAppInvoiceStatement,
} from '../../src/shared/statements/get-statement-details';
import type { ZambdaInput } from '../../src/shared/types/common';

const ENC_1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const {
  mockClinicalClient,
  mockGetStripeClient,
  mockSendSmsForPatient,
  mockSendGenericOutreachEmail,
  mockResolveStatementAmountsSource,
} = vi.hoisted(() => ({
  mockClinicalClient: { fhir: { search: vi.fn(), create: vi.fn(), get: vi.fn(), patch: vi.fn() } },
  mockGetStripeClient: vi.fn(),
  mockSendSmsForPatient: vi.fn(),
  mockSendGenericOutreachEmail: vi.fn(),
  mockResolveStatementAmountsSource: vi.fn(),
}));

vi.mock('utils/lib/ottehr-config/feature-flags', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  FEATURE_FLAGS_CONFIG: {
    ottehrBillingInvoicingEnabled: true,
    automatedPatientOutreachEnabled: true,
    mailingPaperStatementsEnabled: true,
  },
}));
vi.mock('../../src/shared/auth', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('mock-token'),
}));
vi.mock('../../src/shared/helpers', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  createClinicalOystehrClient: () => mockClinicalClient,
}));
vi.mock('../../src/shared/sentry', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  wrapHandler: (_name: string, fn: (...args: unknown[]) => unknown) => fn,
}));
vi.mock('../../src/shared/communication', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  sendSmsForPatient: (...args: unknown[]) => mockSendSmsForPatient(...args),
  getEmailClient: () => ({ sendGenericOutreachEmail: mockSendGenericOutreachEmail }),
}));
vi.mock('../../src/shared/stripeIntegration', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getStripeClient: (...args: unknown[]) => mockGetStripeClient(...args),
}));
vi.mock('../../src/shared/statements/get-statement-details', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  resolveStatementAmountsSource: (...args: unknown[]) => mockResolveStatementAmountsSource(...args),
}));

const patient: Patient = {
  resourceType: 'Patient',
  id: 'pat-1',
  name: [{ given: ['Katie'], family: 'Test' }],
  telecom: [
    { system: 'phone', value: '+12025550123' },
    { system: 'email', value: 'katie@example.com' },
  ],
};
const encounter: Encounter = {
  resourceType: 'Encounter',
  id: ENC_1,
  status: 'finished',
  class: { code: 'AMB' },
  subject: { reference: 'Patient/pat-1' },
  appointment: [{ reference: 'Appointment/appt-1' }],
};

const secrets = {
  BILLING_INTEGRATION: 'ottehr',
  INVOICING_IN_BILLING_APP: 'true',
  ENVIRONMENT: 'local',
  PATIENT_LOGIN_REDIRECT_URL: 'https://portal.example.com',
};

const headersFor = (sub: string): { Authorization: string } => {
  const b64 = (value: unknown): string => Buffer.from(JSON.stringify(value)).toString('base64url');
  return { Authorization: `Bearer ${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub })}.sig` };
};

let handler!: (input: ZambdaInput) => Promise<APIGatewayProxyResult>;

const runHandler = async (
  body: Record<string, unknown>
): Promise<{ results: { medium: string; success: boolean; error?: string }[] }> => {
  const result = await handler({
    headers: headersFor('billing-client@clients'),
    body: JSON.stringify({ encounterId: ENC_1, ...body }),
    secrets,
  });
  expect(result.statusCode).toBe(200);
  return JSON.parse(result.body);
};

describe('send-billing-outreach-notification', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockClinicalClient.fhir.search.mockImplementation(async () => ({ unbundle: () => [encounter, patient] }));
    mockClinicalClient.fhir.create.mockImplementation(async (resource: object) => ({ ...resource, id: 'created-1' }));
    mockClinicalClient.fhir.get.mockImplementation(async ({ resourceType }: { resourceType: string }) =>
      resourceType === 'Encounter'
        ? encounter
        : { resourceType: 'Appointment', id: 'appt-1', start: '2026-07-01T13:00:00Z' }
    );
    mockSendSmsForPatient.mockResolvedValue({ total: 1, sent: 1, failures: [] });
    mockSendGenericOutreachEmail.mockResolvedValue(undefined);
    ({ index: handler } = (await import('../../src/ehr/send-billing-outreach-notification/index')) as unknown as {
      index: typeof handler;
    });
  });

  it('rejects a caller that is not a machine client', async () => {
    const body = JSON.stringify({ encounterId: ENC_1, mediums: ['sms'], smsTemplate: 'hi' });

    await expect(handler({ headers: headersFor('auth0|staff-user'), body, secrets })).rejects.toMatchObject({
      code: APIErrorCode.NOT_AUTHORIZED,
    });
    expect(mockSendSmsForPatient).not.toHaveBeenCalled();
  });

  it('fills an SMS with the billing invoice values without asking Stripe', async () => {
    const { results } = await runHandler({
      mediums: ['sms'],
      smsTemplate: 'Pay {{amount}} by {{due-date}}: {{invoice-link}}',
      amountCents: 12345,
      dueDate: '2026-08-15',
      invoiceLink: 'https://pay.example.com/inv_1',
    });

    expect(results).toEqual([{ medium: 'sms', success: true }]);
    expect(mockSendSmsForPatient).toHaveBeenCalledExactlyOnceWith(
      'Pay $123.45 by Saturday, August 15, 2026: https://pay.example.com/inv_1',
      mockClinicalClient,
      patient,
      'local'
    );
    expect(mockGetStripeClient).not.toHaveBeenCalled();
  });

  it.each([
    [true, 'Update regarding your visit'],
    [undefined, 'Important information about your visit'],
  ])('with chargeOutcome %s emails with subject %s', async (chargeOutcome, subject) => {
    const { results } = await runHandler({
      mediums: ['email'],
      emailTemplate: 'Hello {{patient-full-name}}',
      chargeOutcome,
    });

    expect(results).toEqual([{ medium: 'email', success: true }]);
    expect(mockSendGenericOutreachEmail).toHaveBeenCalledExactlyOnceWith(
      'katie@example.com',
      expect.objectContaining({ 'subject-text': subject })
    );
  });

  it('creates a mail Task that makes the statement use billing claim amounts', async () => {
    const { results } = await runHandler({ mediums: ['paper-mail'], statementType: 'past-due' });

    expect(results).toEqual([{ medium: 'paper-mail', success: true }]);
    const mailTask = mockClinicalClient.fhir.create.mock.calls
      .map(([resource]) => resource as Task)
      .find((resource) => resource.resourceType === 'Task');
    expect(mailTask).toBeDefined();
    expect(isBillingAppInvoiceStatement(mailTask!)).toBe(true);
  });
});

describe('sub-send-patient-statement-by-mail', () => {
  it('uses billing claim amounts for a mail Task from a billing-app invoice', async () => {
    vi.clearAllMocks();
    mockResolveStatementAmountsSource.mockRejectedValue(new Error('stop after amounts source'));
    mockClinicalClient.fhir.patch.mockResolvedValue({});
    const { index: mailHandler } = (await import(
      '../../src/subscriptions/task/sub-send-patient-statement-by-mail/index'
    )) as unknown as { index: typeof handler };
    const task: Task = {
      resourceType: 'Task',
      id: 'mail-task-1',
      status: 'requested',
      intent: 'order',
      code: { coding: [TaskIndicator.sendPatientStatementByMail] },
      encounter: { reference: `Encounter/${ENC_1}` },
      input: [
        {
          type: {
            coding: [{ system: 'https://fhir.ottehr.com/CodeSystem/patient-statement-mail-task-input', code: 'color' }],
          },
          valueString: 'false',
        },
        BILLING_APP_INVOICE_STATEMENT_INPUT,
      ],
    };

    await expect(mailHandler({ headers: null, body: JSON.stringify(task), secrets })).rejects.toThrow(
      'stop after amounts source'
    );
    expect(mockResolveStatementAmountsSource).toHaveBeenCalledWith(
      expect.objectContaining({ billingAppInvoice: true })
    );
  });
});
