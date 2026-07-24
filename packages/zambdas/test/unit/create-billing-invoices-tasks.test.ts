import type { APIGatewayProxyResult } from 'aws-lambda';
import { PatientArClaimItem } from 'utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ZambdaInput } from '../../src/shared/types/common';

const mockZambdaExecute = vi.fn();
const mockBillingClient = {
  zambda: {
    execute: (...args: unknown[]) => mockZambdaExecute(...args),
  },
};
const mockEraReadClient = { eraRead: true };
const mockFetchAllActivePatientArClaims = vi.fn();

vi.mock('../../src/shared', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('mock-token'),
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

type ZambdaHandler = (input: ZambdaInput) => Promise<APIGatewayProxyResult>;

let handler!: ZambdaHandler;
let warnSpy!: ReturnType<typeof vi.spyOn>;

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
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    ({ index: handler } = (await import('../../src/cron/create-billing-invoices-tasks/index')) as unknown as {
      index: ZambdaHandler;
    });
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('skips without touching billing when the env is candid-only', async () => {
    const result = await handler({
      headers: null,
      body: null,
      secrets: {
        BILLING_INTEGRATION: 'candid',
      },
    });

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).message).toContain('disabled');
    expect(mockFetchAllActivePatientArClaims).not.toHaveBeenCalled();
    expect(mockZambdaExecute).not.toHaveBeenCalled();
  });

  it('forwards linked active AR claims to the clinical endpoint', async () => {
    mockFetchAllActivePatientArClaims.mockResolvedValue([arItem()]);
    mockZambdaExecute.mockResolvedValue({
      output: {
        created: 1,
        skipped: 0,
      },
    });

    const result = await runHandler();
    expect(result.statusCode).toBe(200);

    expect(mockFetchAllActivePatientArClaims).toHaveBeenCalledWith(
      expect.objectContaining({
        billingClient: mockBillingClient,
        eraReadClient: mockEraReadClient,
      })
    );
    expect(mockZambdaExecute).toHaveBeenCalledWith({
      id: 'create-invoice-tasks-for-billing-claims',
      claims: [
        {
          claimId: 'claim-1',
          encounterId: 'enc-1',
          finalizationDate: '2026-07-10T12:00:00.000Z',
          balance: 50.5,
        },
      ],
    });

    const body = JSON.parse(result.body);
    expect(body.created).toBe(1);
    expect(body.skipped).toBe(0);
  });

  it('drops claims without encounter linkage and does not call the endpoint when none remain', async () => {
    mockFetchAllActivePatientArClaims.mockResolvedValue([
      arItem({
        claimId: 'claim-unlinked',
        encounterId: null,
      }),
    ]);

    const result = await runHandler();

    expect(mockZambdaExecute).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('no encounter linkage'));
    expect(JSON.parse(result.body).created).toBe(0);
  });

  it('forwards every linked claim from a single fetch', async () => {
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
    mockZambdaExecute.mockResolvedValue({
      output: {
        created: 2,
        skipped: 0,
      },
    });

    await runHandler();

    expect(mockFetchAllActivePatientArClaims).toHaveBeenCalledTimes(1);
    expect(mockZambdaExecute).toHaveBeenCalledTimes(1);
    const call = mockZambdaExecute.mock.calls[0][0] as { claims: { claimId: string }[] };
    expect(call.claims.map((c) => c.claimId)).toEqual(['claim-1', 'claim-2']);
  });
});
