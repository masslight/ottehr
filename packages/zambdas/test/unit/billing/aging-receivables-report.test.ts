import Oystehr from '@oystehr/sdk';
import { Claim, ClaimResponse, Organization } from 'fhir/r4b';
import Stripe from 'stripe';
import { describe, expect, it, vi } from 'vitest';
import { agingReceivablesReport } from '../../../src/billing/reports/definitions/aging-receivables.report';
import { reportRegistry } from '../../../src/billing/reports/framework/registry';

vi.mock('../../../src/billing/claim-amounts', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  fetchClaimResponsesByClaimIds: vi.fn(),
}));
vi.mock('../../../src/billing/shared', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  resolvePayersByRef: vi.fn(),
  resolvedPayerId: vi.fn((org?: Organization) => org?.identifier?.[0]?.value),
}));
vi.mock('../../../src/billing/reports/shared', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  searchAllViaBulk: vi.fn(),
  listStripeAccounts: vi.fn(),
}));
vi.mock('../../../src/shared/stripeIntegration', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getRateLimitedStripeClient: vi.fn(),
}));

import { fetchClaimResponsesByClaimIds } from '../../../src/billing/claim-amounts';
import { listStripeAccounts, searchAllViaBulk } from '../../../src/billing/reports/shared';
import { resolvePayersByRef } from '../../../src/billing/shared';
import { getRateLimitedStripeClient } from '../../../src/shared/stripeIntegration';

const claim = (id: string, billed: number, payerRef?: string, payerDisplay?: string): Claim => ({
  resourceType: 'Claim',
  id,
  status: 'active',
  type: { text: 'professional' },
  use: 'claim',
  patient: {},
  created: '2026-01-01T00:00:00Z',
  provider: {},
  priority: {},
  insurance: [],
  total: { value: billed, currency: 'USD' },
  ...(payerRef ? { insurer: { reference: payerRef, ...(payerDisplay ? { display: payerDisplay } : {}) } } : {}),
});

const eraResponse = (): ClaimResponse =>
  ({ resourceType: 'ClaimResponse', status: 'active', outcome: 'complete' }) as ClaimResponse;

const payerOrg = (name: string, payerId: string): Organization => ({
  resourceType: 'Organization',
  name,
  identifier: [{ value: payerId }],
});

// Stripe listings are consumed with `for await`; a plain array wrapped this way suffices
const asyncListing = (invoices: Partial<Stripe.Invoice>[]): unknown => ({
  [Symbol.asyncIterator]: async function* () {
    yield* invoices as Stripe.Invoice[];
  },
});

const computeWith = async (input: {
  claims: Claim[];
  payersByRef?: Map<string, Organization>;
  claimResponsesByClaimId?: Record<string, ClaimResponse[]>;
  accounts?: (string | undefined)[];
  invoicesByAccount?: Record<string, Partial<Stripe.Invoice>[]>;
}): Promise<Awaited<ReturnType<typeof agingReceivablesReport.compute>>> => {
  vi.mocked(searchAllViaBulk).mockResolvedValue(input.claims);
  vi.mocked(resolvePayersByRef).mockResolvedValue(input.payersByRef ?? new Map());
  vi.mocked(fetchClaimResponsesByClaimIds).mockResolvedValue(
    new Map(Object.entries(input.claimResponsesByClaimId ?? {}))
  );
  vi.mocked(listStripeAccounts).mockResolvedValue(input.accounts ?? [undefined]);
  const list = vi.fn((_params: unknown, options?: { stripeAccount?: string }) =>
    asyncListing(input.invoicesByAccount?.[options?.stripeAccount ?? 'platform'] ?? [])
  );
  vi.mocked(getRateLimitedStripeClient).mockReturnValue({ invoices: { list } } as unknown as Stripe);
  return agingReceivablesReport.compute(
    { oystehr: {} as Oystehr, untaggedClient: {} as Oystehr, secrets: null },
    {},
    vi.fn(async () => undefined)
  );
};

describe('aging-receivables report', () => {
  it('is registered under its kind', () => {
    expect(reportRegistry['aging-receivables']).toBe(agingReceivablesReport);
  });

  it('groups submitted claims per payer with counts and charge-master totals', async () => {
    const { payload } = await computeWith({
      claims: [
        claim('c1', 100, 'Organization/aetna'),
        claim('c2', 50.5, 'Organization/aetna'),
        claim('c3', 200, 'Organization/uhc'),
      ],
      payersByRef: new Map([
        ['Organization/aetna', payerOrg('Aetna', '60054')],
        ['Organization/uhc', payerOrg('United Healthcare', '87726')],
      ]),
    });

    expect(payload.insurance).toEqual({ claimCount: 3, totalBilled: 350.5 });
    expect(payload.payerRows).toEqual([
      {
        payerRef: 'Organization/uhc',
        payerId: '87726',
        payerName: 'United Healthcare',
        claimCount: 1,
        totalBilled: 200,
      },
      { payerRef: 'Organization/aetna', payerId: '60054', payerName: 'Aetna', claimCount: 2, totalBilled: 150.5 },
    ]);
  });

  it('falls back to insurer display, then Unknown Payer, when the payer does not resolve', async () => {
    const { payload } = await computeWith({
      claims: [claim('c1', 10, 'Organization/gone', 'Ghost Payer'), claim('c2', 20)],
    });

    expect(payload.payerRows).toEqual([
      { payerRef: '', payerId: '', payerName: 'Unknown Payer', claimCount: 1, totalBilled: 20 },
      { payerRef: 'Organization/gone', payerId: '', payerName: 'Ghost Payer', claimCount: 1, totalBilled: 10 },
    ]);
  });

  it('excludes claims with any posted ERA from both counts (e.g. crossover forwards back at submitted)', async () => {
    const { payload } = await computeWith({
      claims: [
        // primary ERA posted, crossover reset the status tag to 'submitted' — has an ERA, must not count
        claim('c1', 100, 'Organization/medicare'),
        claim('c2', 40, 'Organization/medicare'),
      ],
      claimResponsesByClaimId: { c1: [eraResponse()] },
      payersByRef: new Map([['Organization/medicare', payerOrg('Medicare', 'MCARE')]]),
    });

    expect(payload.insurance).toEqual({ claimCount: 1, totalBilled: 40 });
    expect(payload.payerRows).toEqual([
      { payerRef: 'Organization/medicare', payerId: 'MCARE', payerName: 'Medicare', claimCount: 1, totalBilled: 40 },
    ]);
  });

  it('scans claims by the insurance-payer AR stage and submitted status tags', async () => {
    await computeWith({ claims: [] });

    expect(vi.mocked(searchAllViaBulk)).toHaveBeenCalledWith(expect.anything(), {
      resourceType: 'Claim',
      params: expect.arrayContaining([
        {
          name: '_tag',
          value: 'https://fhir.ottehr.com/billing/CodeSystem/ar-stage|insurance-payer-ar',
        },
        {
          name: '_tag',
          value: 'https://fhir.ottehr.com/billing/CodeSystem/insurance-ar-status|submitted',
        },
      ]),
    });
  });

  it('counts a claim without a total as zero billed', async () => {
    const { payload } = await computeWith({
      claims: [{ ...claim('c1', 0, 'Organization/aetna'), total: undefined }],
    });

    expect(payload.insurance).toEqual({ claimCount: 1, totalBilled: 0 });
  });

  it('serves a zeroed payload with a generation stamp when nothing is outstanding', async () => {
    const { payload } = await computeWith({ claims: [] });

    expect(payload.insurance).toEqual({ claimCount: 0, totalBilled: 0 });
    expect(payload.payerRows).toEqual([]);
    expect(payload.patient).toEqual({ invoiceCount: 0, amountDue: 0 });
    expect(payload.generatedAt).toBeTruthy();
  });

  it('sums open invoice balances across accounts without cross-account dedupe (ids are account-scoped)', async () => {
    const { payload } = await computeWith({
      claims: [],
      accounts: [undefined, 'acct_1'],
      invoicesByAccount: {
        platform: [
          { id: 'in_1', amount_remaining: 2500, amount_due: 5000 },
          { id: 'in_2', amount_remaining: 1000 },
        ],
        acct_1: [
          { id: 'in_2', amount_remaining: 1000 },
          { id: 'in_3', amount_due: 750 },
        ],
      },
    });

    expect(payload.patient).toEqual({ invoiceCount: 4, amountDue: 52.5 });
  });
});
