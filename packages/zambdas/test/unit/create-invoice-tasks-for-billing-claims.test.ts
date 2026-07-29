import type { APIGatewayProxyResult } from 'aws-lambda';
import { Bundle, Encounter, Task } from 'fhir/r4b';
import {
  BillingInvoiceTaskClaim,
  INVOICE_TASK_CLAIM_ID_IDENTIFIER_SYSTEM,
  INVOICE_TASK_SOURCE_SYSTEM,
  parseInvoiceTaskInput,
  RcmTaskCodings,
} from 'utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ZambdaInput } from '../../src/shared/types/common';

const CLAIM_1 = '11111111-1111-4111-8111-111111111111';
const CLAIM_2 = '22222222-2222-4222-8222-222222222222';
const CLAIM_3 = '33333333-3333-4333-8333-333333333333';
const CLAIM_OTHER = '99999999-9999-4999-8999-999999999999';
const ENC_1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ENC_2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ENC_MISSING = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const mockClinicalClient = {
  fhir: {
    search: vi.fn(),
    create: vi.fn(),
  },
};
const mockCaptureException = vi.fn();

vi.mock('../../src/shared', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('mock-token'),
    createClinicalOystehrClient: () => mockClinicalClient,
    wrapHandler: (_name: string, fn: (...args: unknown[]) => unknown) => fn,
  };
});

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
let warnSpy!: ReturnType<typeof vi.spyOn>;

const claimInput = (overrides: Partial<BillingInvoiceTaskClaim> = {}): BillingInvoiceTaskClaim => ({
  claimId: CLAIM_1,
  encounterId: ENC_1,
  finalizationDate: '2026-07-10T12:00:00.000Z',
  balance: 50.5,
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
          meta: {
            tag: [
              {
                system: INVOICE_TASK_SOURCE_SYSTEM,
                code: 'ottehr-billing',
              },
            ],
          },
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

const runHandler = (claims: BillingInvoiceTaskClaim[]): Promise<APIGatewayProxyResult> =>
  handler({
    headers: null,
    body: JSON.stringify({ claims }),
    secrets: {},
  });

describe('create-invoice-tasks-for-billing-claims', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockClinicalClient.fhir.create.mockImplementation((task: Task) =>
      Promise.resolve({
        ...task,
        id: 'created-1',
      })
    );
    ({ index: handler } = (await import('../../src/ehr/create-invoice-tasks-for-billing-claims/index')) as unknown as {
      index: ZambdaHandler;
    });
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('does no work for an empty claim list', async () => {
    const result = await runHandler([]);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ created: 0, skipped: 0 });
    expect(mockClinicalClient.fhir.search).not.toHaveBeenCalled();
    expect(mockClinicalClient.fhir.create).not.toHaveBeenCalled();
  });

  it('creates a billing-sourced task for a claim needing one', async () => {
    mockClinicalClient.fhir.search.mockResolvedValue(bundleOf([encounter(ENC_1)]));

    const result = await runHandler([claimInput()]);
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({
      created: 1,
      skipped: 0,
    });

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
        value: CLAIM_1,
      },
    ]);
    expect(createdTask.encounter?.reference).toBe(`Encounter/${ENC_1}`);
    expect(parseInvoiceTaskInput(createdTask).amountCents).toBe(5050);
    expect(parseInvoiceTaskInput(createdTask).claimId).toBe(CLAIM_1);

    const sendInvoiceCoding = RcmTaskCodings.sendInvoiceToPatient.coding?.[0];
    const createOptions = mockClinicalClient.fhir.create.mock.calls[0][1] as { ifNoneExist?: unknown };
    expect(createOptions.ifNoneExist).toEqual([
      {
        name: 'encounter',
        value: `Encounter/${ENC_1}`,
      },
      {
        name: 'code',
        value: `${sendInvoiceCoding?.system}|${sendInvoiceCoding?.code}`,
      },
    ]);
  });

  it('skips a claim whose clinical encounter is missing, and reports it', async () => {
    mockClinicalClient.fhir.search.mockResolvedValue(bundleOf([]));

    const result = await runHandler([claimInput()]);

    expect(JSON.parse(result.body)).toEqual({
      created: 0,
      skipped: 1,
    });
    expect(mockClinicalClient.fhir.create).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('No clinical encounter'));
  });

  it('skips quietly when the claim already has its own invoice task', async () => {
    mockClinicalClient.fhir.search.mockResolvedValue(bundleOf([encounter(ENC_1), sendInvoiceTask(ENC_1, CLAIM_1)]));

    const result = await runHandler([claimInput()]);

    expect(JSON.parse(result.body)).toEqual({ created: 0, skipped: 1 });
    expect(mockClinicalClient.fhir.create).not.toHaveBeenCalled();
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it('warns naming the candid source when a legacy candid task blocks the encounter', async () => {
    mockClinicalClient.fhir.search.mockResolvedValue(bundleOf([encounter(ENC_1), sendInvoiceTask(ENC_1)]));

    const result = await runHandler([claimInput()]);

    expect(JSON.parse(result.body)).toEqual({ created: 0, skipped: 1 });
    expect(mockClinicalClient.fhir.create).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('candid-sourced'));
  });

  it('warns naming the billing source when a different billing claim already holds the encounter', async () => {
    mockClinicalClient.fhir.search.mockResolvedValue(bundleOf([encounter(ENC_1), sendInvoiceTask(ENC_1, CLAIM_OTHER)]));

    const result = await runHandler([claimInput({ claimId: CLAIM_1 })]);

    expect(JSON.parse(result.body)).toEqual({
      created: 0,
      skipped: 1,
    });
    expect(mockClinicalClient.fhir.create).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('ottehr-billing-sourced'));
  });

  it('processes the whole claim list, reporting created and skipped counts', async () => {
    mockClinicalClient.fhir.search.mockResolvedValue(bundleOf([encounter(ENC_1), encounter(ENC_2)]));

    const result = await runHandler([
      claimInput({
        claimId: CLAIM_1,
        encounterId: ENC_1,
      }),
      claimInput({
        claimId: CLAIM_2,
        encounterId: ENC_2,
      }),
      claimInput({
        claimId: CLAIM_3,
        encounterId: ENC_MISSING,
      }),
    ]);

    expect(mockClinicalClient.fhir.create).toHaveBeenCalledTimes(2);
    expect(JSON.parse(result.body)).toEqual({ created: 2, skipped: 1 });
  });
});
