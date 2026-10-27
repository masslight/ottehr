import Oystehr from '@oystehr/sdk';
import { ClaimResponse, PaymentReconciliation } from 'fhir/r4b';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchClaimEraLinks } from '../../../src/billing/claim-amounts';
import { performEffect as match } from '../../../src/billing/match-claim-response';
import { performEffect as unmatch } from '../../../src/billing/unmatch-claim-response';

vi.mock('../../../src/billing/claim-amounts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchClaimEraLinks: vi.fn(),
}));

const era: PaymentReconciliation = {
  resourceType: 'PaymentReconciliation',
  id: 'era-1',
  status: 'active',
  created: '2026-09-01',
  paymentDate: '2026-09-01',
  paymentAmount: { value: 100 },
};
const response: ClaimResponse = {
  resourceType: 'ClaimResponse',
  id: 'cr-1',
  meta: { versionId: '5' },
  status: 'active',
  use: 'claim',
  type: {},
  patient: {},
  insurer: {},
  created: '2026-09-01',
  outcome: 'complete',
  request: { reference: '#request' },
};
const get = vi.fn();
const transaction = vi.fn();
const client = { fhir: { get, transaction } } as unknown as Oystehr;
const params = { claimResponseId: 'cr-1', claimId: 'claim-1', secrets: {} };
const links = (eras: PaymentReconciliation[]): Awaited<ReturnType<typeof fetchClaimEraLinks>> => ({
  paymentReconciliations: eras,
  paymentReconciliationIdByClaimResponseId: new Map([['cr-1', 'era-1']]),
});

beforeEach(() => {
  vi.resetAllMocks();
  get.mockImplementation(async ({ resourceType }) =>
    resourceType === 'Claim'
      ? {
          resourceType: 'Claim',
          id: 'claim-1',
          insurer: { reference: 'Organization/payer' },
          patient: { reference: 'Patient/p1' },
          type: {},
        }
      : response
  );
  transaction.mockResolvedValue({ unbundle: () => [response] });
  vi.mocked(fetchClaimEraLinks).mockResolvedValue(links([era]));
});

describe.each([
  { name: 'match', perform: match },
  { name: 'unmatch', perform: unmatch },
])('$name on a voided ERA', ({ perform }) => {
  it('patches the response of an active ERA at the version it checked', async () => {
    await expect(perform(client, params)).resolves.toEqual(response);
    expect(fetchClaimEraLinks).toHaveBeenCalledWith(client, [response]);
    expect(transaction).toHaveBeenCalledWith({
      requests: [expect.objectContaining({ method: 'PATCH', url: '/ClaimResponse/cr-1', ifMatch: 'W/"5"' })],
    });
  });

  it('fails without retrying when a void cancels the response after the check', async () => {
    const conflict = new Oystehr.OystehrSdkError({ message: 'precondition failed', code: 412 });
    transaction.mockRejectedValueOnce(conflict);
    await expect(perform(client, params)).rejects.toBe(conflict);
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('rejects a voided ERA before writing', async () => {
    vi.mocked(fetchClaimEraLinks).mockResolvedValue(links([{ ...era, status: 'cancelled' }]));
    await expect(perform(client, params)).rejects.toMatchObject({
      message: 'Voided ERAs cannot be changed',
    });
    expect(transaction).not.toHaveBeenCalled();
  });

  it('still patches a response no ERA links to', async () => {
    vi.mocked(fetchClaimEraLinks).mockResolvedValue(links([]));
    await expect(perform(client, params)).resolves.toEqual(response);
    expect(transaction).toHaveBeenCalledTimes(1);
  });
});
