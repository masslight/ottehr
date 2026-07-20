import type { APIGatewayProxyResult } from 'aws-lambda';
import { Bundle, Encounter, Task } from 'fhir/r4b';
import {
  INVOICE_TASK_CLAIM_ID_IDENTIFIER_SYSTEM,
  INVOICE_TASK_SOURCE_SYSTEM,
  parseInvoiceTaskInput,
  PatientArClaimItem,
  RcmTaskCodings,
} from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ZambdaInput } from '../../src/shared/types/common';

const mockClinicalClient = {
  fhir: {
    search: vi.fn(),
    create: vi.fn(),
  },
};
const mockBillingClient = { billing: true };
const mockEraReadClient = { eraRead: true };
const mockCreateClinicalOystehrClient = vi.fn((..._args: unknown[]) => mockClinicalClient);
const mockFetchAllActivePatientArClaims = vi.fn();
const mockCaptureException = vi.fn();

vi.mock('../../src/shared', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('mock-token'),
    createClinicalOystehrClient: (...args: unknown[]) => mockCreateClinicalOystehrClient(...args),
    wrapHandler: (_name: string, fn: (...args: unknown[]) => unknown) => fn,
  };
});

vi.mock('../../src/billing/shared', () => ({
  createBillingClient: () => mockBillingClient,
  createEraReadClient: () => mockEraReadClient,
}));

vi.mock('../../src/billing/search-billing-patient-ar-claims/handler', () => ({
  fetchAllActivePatientArClaims: (...args: unknown[]) => mockFetchAllActivePatientArClaims(...args),
}));

vi.mock('../../src/rcm/invoice-config/helpers', () => ({
  getOrCreateInvoicingConfig: vi.fn().mockResolvedValue({ questionnaireResponse: {} }),
  parseInvoicingConfig: () => ({
    dueDaysFromGeneration: 30,
    defaultSmsTemplate: 'sms template',
    defaultInvoiceMemo: 'memo template',
  }),
}));

vi.mock('@sentry/aws-serverless', () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

type ZambdaHandler = (input: ZambdaInput) => Promise<APIGatewayProxyResult>;

let handler!: ZambdaHandler;

const arItem = (overrides: Partial<PatientArClaimItem> = {}): PatientArClaimItem => ({
  claimId: 'claim-1',
  patientId: 'pat-1',
  patientName: 'Test, Katie',
  patientDob: '1990-01-15',
  encounterId: 'enc-1',
  appointmentId: 'appt-1',
  serviceDate: '2026-07-01',
  finalizationDate: '2026-07-10T12:00:00.000Z',
  billed: 100,
  allowed: 80,
  insurancePaid: 30,
  patientResp: 50.5,
  patientPaid: 0,
  balance: 50.5,
  adjudicated: true,
  ...overrides,
});

const encounter = (id: string): Encounter =>
  ({
    resourceType: 'Encounter',
    id,
    status: 'finished',
    class: {
      code: 'AMB',
    },
    subject: {
      reference: 'Patient/pat-1',
    },
    period: {
      start: '2026-07-01T09:00:00Z',
    },
  }) as Encounter;

const sendInvoiceTask = (encounterId: string, claimId?: string): Task =>
  ({
    resourceType: 'Task',
    id: `task-${encounterId}-${claimId ?? 'other'}`,
    status: 'ready',
    intent: 'order',
    code: RcmTaskCodings.sendInvoiceToPatient,
    encounter: {
      reference: `Encounter/${encounterId}`,
    },
    ...(claimId
      ? {
          identifier: [
            {
              system: INVOICE_TASK_CLAIM_ID_IDENTIFIER_SYSTEM,
              value: claimId,
            },
          ],
        }
      : {}),
  }) as Task;

const bundleOf = (resources: (Encounter | Task)[]): Pick<Bundle, 'resourceType'> & { unbundle: () => unknown[] } => ({
  resourceType: 'Bundle',
  unbundle: () => resources,
});

const secrets = { BILLING_INTEGRATION: 'ottehr' };

const runHandler = (): Promise<APIGatewayProxyResult> =>
  handler({
    headers: null,
    body: null,
    secrets,
  });

describe('create-billing-invoices-tasks', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    mockClinicalClient.fhir.create.mockImplementation((task: Task) => Promise.resolve({ ...task, id: 'created-1' }));
    ({ index: handler } = (await import('../../src/cron/create-billing-invoices-tasks/index')) as unknown as {
      index: ZambdaHandler;
    });
  });

  it('skips without touching any client when the env is candid-only', async () => {
    const result = await handler({
      headers: null,
      body: null,
      secrets: {
        BILLING_INTEGRATION: 'candid',
      },
    });

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).message).toContain('disabled');
    expect(mockCreateClinicalOystehrClient).not.toHaveBeenCalled();
    expect(mockFetchAllActivePatientArClaims).not.toHaveBeenCalled();
  });

  it('creates a billing-sourced task for an active AR claim', async () => {
    mockFetchAllActivePatientArClaims.mockResolvedValue([arItem()]);
    mockClinicalClient.fhir.search.mockResolvedValue(bundleOf([encounter('enc-1')]));

    const result = await runHandler();
    expect(result.statusCode).toBe(200);

    expect(mockFetchAllActivePatientArClaims).toHaveBeenCalledWith(
      expect.objectContaining({
        billingClient: mockBillingClient,
        eraReadClient: mockEraReadClient,
      })
    );

    expect(mockClinicalClient.fhir.create).toHaveBeenCalledTimes(1);
    const createdTask = mockClinicalClient.fhir.create.mock.calls[0][0] as Task;
    expect(createdTask.meta?.tag).toEqual([
      {
        system: INVOICE_TASK_SOURCE_SYSTEM,
        code: 'ottehr-billing',
      },
    ]);
    expect(createdTask.identifier).toEqual([
      {
        system: INVOICE_TASK_CLAIM_ID_IDENTIFIER_SYSTEM,
        value: 'claim-1',
      },
    ]);
    expect(createdTask.encounter?.reference).toBe('Encounter/enc-1');
    expect(parseInvoiceTaskInput(createdTask).amountCents).toBe(5050);
    expect(parseInvoiceTaskInput(createdTask).claimId).toBe('claim-1');
  });

  it('skips claims without encounter linkage, loudly', async () => {
    mockFetchAllActivePatientArClaims.mockResolvedValue([
      arItem({
        claimId: 'claim-unlinked',
        encounterId: null,
      }),
    ]);

    await runHandler();

    expect(mockClinicalClient.fhir.create).not.toHaveBeenCalled();
    expect(mockCaptureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('no encounter linkage') }),
      expect.anything()
    );
  });

  it('skips quietly when the claim already has its own invoice task', async () => {
    mockFetchAllActivePatientArClaims.mockResolvedValue([arItem()]);
    mockClinicalClient.fhir.search.mockResolvedValue(
      bundleOf([encounter('enc-1'), sendInvoiceTask('enc-1', 'claim-1')])
    );

    await runHandler();

    expect(mockClinicalClient.fhir.create).not.toHaveBeenCalled();
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it('skips loudly when the encounter already has a task from another source', async () => {
    mockFetchAllActivePatientArClaims.mockResolvedValue([arItem()]);
    mockClinicalClient.fhir.search.mockResolvedValue(bundleOf([encounter('enc-1'), sendInvoiceTask('enc-1')]));

    await runHandler();

    expect(mockClinicalClient.fhir.create).not.toHaveBeenCalled();
    expect(mockCaptureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('another source') }),
      expect.anything()
    );
  });

  it('processes the whole AR queue from a single fetch', async () => {
    mockFetchAllActivePatientArClaims.mockResolvedValue([
      arItem({
        claimId: 'claim-1',
        encounterId: 'enc-1',
      }),
      arItem({
        claimId: 'claim-2',
        encounterId: 'enc-2',
      }),
    ]);
    mockClinicalClient.fhir.search.mockResolvedValue(bundleOf([encounter('enc-1'), encounter('enc-2')]));

    await runHandler();

    expect(mockFetchAllActivePatientArClaims).toHaveBeenCalledTimes(1);
    expect(mockClinicalClient.fhir.create).toHaveBeenCalledTimes(2);
  });
});
