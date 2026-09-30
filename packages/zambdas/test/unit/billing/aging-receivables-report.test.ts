import Oystehr from '@oystehr/sdk';
import { Claim, ClaimResponse, Coverage, Organization } from 'fhir/r4b';
import Stripe from 'stripe';
import { CLAIM_TAG_SYSTEM } from 'utils/lib/types/data/billing/billing.constants';
import { SECONDARY_SUBMISSION_CROSSOVER_TAG_NAME } from 'utils/lib/types/data/billing/system-tags';
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

// a claim forwarded via crossover: primary ERA posted, status back to 'submitted', insurer untouched
const crossoverClaim = (id: string, billed: number, payerRef: string, coverageRefs: string[]): Claim => ({
  ...claim(id, billed, payerRef),
  meta: { tag: [{ system: CLAIM_TAG_SYSTEM, code: SECONDARY_SUBMISSION_CROSSOVER_TAG_NAME }] },
  insurance: coverageRefs.map((reference, index) => ({
    sequence: index + 1,
    focal: index === 0,
    coverage: { reference },
  })),
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
  coverages?: Coverage[];
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
  const oystehr = {
    fhir: {
      search: vi.fn(async () => ({ unbundle: () => input.coverages ?? [] })),
    },
  } as unknown as Oystehr;
  return agingReceivablesReport.compute(
    { oystehr, untaggedClient: {} as Oystehr, secrets: null },
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

  it('attributes crossover claims to the coverage awaiting its ERA, not Claim.insurer', async () => {
    const { payload } = await computeWith({
      claims: [
        crossoverClaim('c1', 100, 'Organization/medicare', ['Coverage/cov-primary', 'Coverage/cov-secondary']),
        claim('c2', 40, 'Organization/medicare'),
      ],
      claimResponsesByClaimId: { c1: [eraResponse()] },
      coverages: [
        { resourceType: 'Coverage', id: 'cov-secondary', payor: [{ reference: 'Organization/medicaid' }] } as Coverage,
      ],
      payersByRef: new Map([
        ['Organization/medicare', payerOrg('Medicare', 'MCARE')],
        ['Organization/medicaid', payerOrg('Medicaid', 'MCAID')],
      ]),
    });

    expect(payload.payerRows).toEqual([
      { payerRef: 'Organization/medicaid', payerId: 'MCAID', payerName: 'Medicaid', claimCount: 1, totalBilled: 100 },
      { payerRef: 'Organization/medicare', payerId: 'MCARE', payerName: 'Medicare', claimCount: 1, totalBilled: 40 },
    ]);
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
