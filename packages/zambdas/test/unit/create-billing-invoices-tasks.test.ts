import type { APIGatewayProxyResult } from 'aws-lambda';
import { PatientArClaimItem } from 'utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchAllActivePatientArClaims } from '../../src/billing/search-billing-patient-ar-claims/handler';
import { createBillingClient } from '../../src/billing/shared';
import { index } from '../../src/cron/create-billing-invoices-tasks/index';
import { checkOrCreateM2MClientToken } from '../../src/shared';
import type { ZambdaInput } from '../../src/shared/types/common';

// Shared modules (src/shared, src/billing/*) are mocked suite-wide in vitest.unit-mocks.setup.ts.

const mockZambdaExecute = vi.fn();
const mockBillingClient = {
  zambda: {
    execute: (...args: unknown[]) => mockZambdaExecute(...args),
  },
};

type ZambdaHandler = (input: ZambdaInput) => Promise<APIGatewayProxyResult>;

const handler = index as unknown as ZambdaHandler;

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

const secrets = { BILLING_INTEGRATION: 'ottehr', ENVIRONMENT: 'local' };

const runHandler = (): Promise<APIGatewayProxyResult> =>
  handler({
    headers: null,
    body: null,
    secrets,
  });

describe('create-billing-invoices-tasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(checkOrCreateM2MClientToken).mockResolvedValue('mock-token');
    vi.mocked(createBillingClient).mockReturnValue(mockBillingClient as never);
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
        ENVIRONMENT: 'local',
      },
    });

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).message).toContain('disabled');
    expect(fetchAllActivePatientArClaims).not.toHaveBeenCalled();
    expect(mockZambdaExecute).not.toHaveBeenCalled();
  });

  it('forwards linked active AR claims to the clinical endpoint', async () => {
    vi.mocked(fetchAllActivePatientArClaims).mockResolvedValue([arItem()]);
    mockZambdaExecute.mockResolvedValue({
      output: {
        created: 1,
        skipped: 0,
      },
    });

    const result = await runHandler();
    expect(result.statusCode).toBe(200);

    expect(fetchAllActivePatientArClaims).toHaveBeenCalledWith(mockBillingClient);
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
    vi.mocked(fetchAllActivePatientArClaims).mockResolvedValue([
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
    vi.mocked(fetchAllActivePatientArClaims).mockResolvedValue([
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

    expect(fetchAllActivePatientArClaims).toHaveBeenCalledTimes(1);
    expect(mockZambdaExecute).toHaveBeenCalledTimes(1);
    const call = mockZambdaExecute.mock.calls[0][0] as { claims: { claimId: string }[] };
    expect(call.claims.map((c) => c.claimId)).toEqual(['claim-1', 'claim-2']);
  });
});
