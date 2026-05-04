import { CANDID_BATCH_SIZE } from 'utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@sentry/aws-serverless', () => ({
  captureException: vi.fn(),
}));

vi.mock('../../src/shared', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    wrapHandler: (_name: string, handler: any) => handler,
  };
});

const { populateAmountInPackages } = await import('../../src/cron/create-invoices-tasks');

const okItemization = (claimId: string, patientBalanceCents = 1234): any => ({
  ok: true,
  body: { claimId, patientBalanceCents },
  rawResponse: { status: 200, headers: new Headers() },
});

const tooManyRequestsResponse = (): any => ({
  ok: false,
  error: { errorName: 'TooManyRequestsError' },
  rawResponse: { status: 429, headers: new Headers() },
});

const mkPackage = (claimId: string): any => ({
  encounter: { id: `enc-${claimId}`, resourceType: 'Encounter' },
  claim: { claimId, patientArStatus: 'invoiceable' },
});

describe('populateAmountInPackages', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('caps in-flight itemize calls at CANDID_BATCH_SIZE', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const itemize = vi.fn().mockImplementation(async (claimId: string) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      return okItemization(claimId);
    });
    const candid: any = { patientAr: { v1: { itemize } } };

    const packages = Array.from({ length: 9 }, (_, i) => mkPackage(`claim-${i}`));
    const promise = populateAmountInPackages(candid, packages);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toHaveLength(9);
    expect(itemize).toHaveBeenCalledTimes(9);
    expect(maxInFlight).toBeLessThanOrEqual(CANDID_BATCH_SIZE);
  });

  it('retries a 429 itemize response and includes the recovered package', async () => {
    const itemize = vi
      .fn()
      .mockResolvedValueOnce(tooManyRequestsResponse())
      .mockResolvedValueOnce(okItemization('claim-0', 5000));
    const candid: any = { patientAr: { v1: { itemize } } };

    const promise = populateAmountInPackages(candid, [mkPackage('claim-0')]);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(itemize).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(1);
    expect(result[0].amountCents).toBe(5000);
  });
});
