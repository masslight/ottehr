import Oystehr from '@oystehr/sdk';
import { PaymentReconciliation } from 'fhir/r4b';
import { beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import { fetchClaimResponsesByPaymentReconciliations } from '../../../src/billing/claim-amounts';
import { performEffect } from '../../../src/billing/search-billing-eras';
import { SearchErasParams } from '../../../src/billing/search-billing-eras/validateRequestParameters';
import { ERA_CHECK_SYSTEM, resolvePayersByRef } from '../../../src/billing/shared';

vi.mock('../../../src/billing/claim-amounts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchClaimResponsesByPaymentReconciliations: vi.fn(),
}));

vi.mock('../../../src/billing/shared', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  resolvePayersByRef: vi.fn(),
}));

// The Claim.MD converter stamps a searchable identifier
const claimMdEra = (id: string, checkNumber: string): PaymentReconciliation => ({
  resourceType: 'PaymentReconciliation',
  id,
  status: 'active',
  created: '2026-07-20T10:00:00Z',
  paymentDate: '2026-07-18',
  paymentAmount: {
    value: 60,
    currency: 'USD',
  },
  identifier: [
    {
      system: ERA_CHECK_SYSTEM,
      value: checkNumber,
    },
  ],
  paymentIdentifier: {
    system: ERA_CHECK_SYSTEM,
    value: checkNumber,
  },
  outcome: 'complete',
});

// process-era, which the Import ERA dialog uses, sets paymentIdentifier only
const importedEra = (id: string, checkNumber: string): PaymentReconciliation => {
  const era = claimMdEra(id, checkNumber);
  delete era.identifier;
  return era;
};

type SearchCall = { resourceType: string; params: { name: string; value: string }[] };

const paramValue = (call: SearchCall, name: string): string | undefined =>
  call.params.find((param) => param.name === name)?.value;

const isScan = (call: SearchCall): boolean => paramValue(call, '_elements') != null;
const isPageFetch = (call: SearchCall): boolean => paramValue(call, '_id') != null;

const bundle = (resources: Partial<PaymentReconciliation>[], hasNextPage = false): unknown => ({
  total: resources.length,
  entry: resources.map((resource) => ({ resource })),
  ...(hasNextPage
    ? {
        link: [
          {
            relation: 'next',
            url: 'next-page',
          },
        ],
      }
    : {}),
  unbundle: () => resources,
});

// _elements makes the server answer with partial resources, so the scan must cope with fields the
// list needs being absent until the page is fetched in full.
const projected = (eras: PaymentReconciliation[]): Partial<PaymentReconciliation>[] =>
  eras.map((era) => ({
    resourceType: 'PaymentReconciliation',
    id: era.id,
    identifier: era.identifier,
    paymentIdentifier: era.paymentIdentifier,
  }));

// scanPages splits the scan across pages the way the server would; fetchAllPages follows next links.
const makeOystehr = (
  eras: PaymentReconciliation[],
  scanPages?: PaymentReconciliation[][]
): {
  oystehr: Oystehr;
  search: Mock;
} => {
  let scanCall = 0;
  const search = vi.fn().mockImplementation((call: SearchCall) => {
    if (isPageFetch(call)) {
      const ids = new Set(paramValue(call, '_id')!.split(','));
      return Promise.resolve(bundle(eras.filter((era) => ids.has(era.id!))));
    }
    if (isScan(call)) {
      if (!scanPages) return Promise.resolve(bundle(projected(eras)));
      const page = scanPages[scanCall];
      scanCall++;
      return Promise.resolve(bundle(projected(page), scanCall < scanPages.length));
    }
    return Promise.resolve(bundle(eras));
  });
  return {
    oystehr: {
      fhir: {
        search,
      },
      rcm: {
        listPayers: vi.fn(),
      },
    } as unknown as Oystehr,
    search,
  };
};

const searchParams = (overrides: Partial<SearchErasParams> = {}): SearchErasParams => ({
  secrets: {} as any,
  ...overrides,
});

describe('search-billing-eras performEffect', () => {
  beforeEach(() => {
    (fetchClaimResponsesByPaymentReconciliations as Mock).mockResolvedValue(new Map());
    (resolvePayersByRef as Mock).mockResolvedValue(new Map());
  });

  it('finds an ERA whose check number the importing converter left only on paymentIdentifier', async () => {
    const { oystehr } = makeOystehr([importedEra('era-1', 'CHK-100')]);

    const result = await performEffect(oystehr, oystehr, searchParams({ checkNumber: 'CHK-100' }));

    expect(result.eras.map((era) => era.id)).toEqual(['era-1']);
    expect(result.eras[0].checkNumber).toBe('CHK-100');
    expect(result.total).toBe(1);
  });

  it('finds an ERA whose check number is a searchable identifier without asking the server to match it', async () => {
    const { oystehr, search } = makeOystehr([claimMdEra('era-1', 'CHK-100')]);

    const result = await performEffect(oystehr, oystehr, searchParams({ checkNumber: 'CHK-100' }));

    expect(result.eras.map((era) => era.id)).toEqual(['era-1']);
    const identifierParams = search.mock.calls.map((call) => paramValue(call[0], 'identifier')).filter(Boolean);
    expect(identifierParams).toEqual([]);
  });

  it('excludes ERAs with a different check number and counts only the matches', async () => {
    const { oystehr } = makeOystehr([
      importedEra('era-1', 'CHK-100'),
      claimMdEra('era-2', 'CHK-200'),
      importedEra('era-3', 'CHK-100'),
    ]);

    const result = await performEffect(oystehr, oystehr, searchParams({ checkNumber: 'CHK-100' }));

    expect(result.eras.map((era) => era.id)).toEqual(['era-1', 'era-3']);
    expect(result.total).toBe(2);
  });

  it('pages the matches rather than the ERAs the server returned', async () => {
    const { oystehr } = makeOystehr([
      importedEra('era-1', 'CHK-100'),
      claimMdEra('era-2', 'CHK-200'),
      importedEra('era-3', 'CHK-100'),
      importedEra('era-4', 'CHK-100'),
    ]);

    const result = await performEffect(
      oystehr,
      oystehr,
      searchParams({
        checkNumber: 'CHK-100',
        offset: 1,
        pageSize: 2,
      })
    );

    expect(result.eras.map((era) => era.id)).toEqual(['era-3', 'era-4']);
    expect(result.total).toBe(3);
    expect(result.offset).toBe(1);
  });

  it('keeps scanning past the first page of ERAs the server returns', async () => {
    const onFirstPage = importedEra('era-1', 'CHK-100');
    const onSecondPage = importedEra('era-2', 'CHK-100');
    const { oystehr, search } = makeOystehr(
      [onFirstPage, onSecondPage],
      [[onFirstPage, claimMdEra('era-9', 'CHK-200')], [onSecondPage]]
    );

    const result = await performEffect(oystehr, oystehr, searchParams({ checkNumber: 'CHK-100' }));

    expect(result.eras.map((era) => era.id)).toEqual(['era-1', 'era-2']);
    expect(result.total).toBe(2);
    const scans = search.mock.calls.map((call) => call[0]).filter(isScan);
    expect(scans).toHaveLength(2);
    expect(paramValue(scans[1], '_offset')).toBe('200');
  });

  it('matches a check number typed in a different case', async () => {
    const { oystehr } = makeOystehr([importedEra('era-1', 'eft-abc123')]);

    const result = await performEffect(oystehr, oystehr, searchParams({ checkNumber: 'EFT-ABC123' }));

    expect(result.eras.map((era) => era.id)).toEqual(['era-1']);
  });

  it('returns nothing when no ERA carries the check number', async () => {
    const { oystehr } = makeOystehr([importedEra('era-1', 'CHK-100')]);

    const result = await performEffect(oystehr, oystehr, searchParams({ checkNumber: 'CHK-999' }));

    expect(result.eras).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('still sends the other filters to the server alongside a check number', async () => {
    const { oystehr, search } = makeOystehr([importedEra('era-1', 'CHK-100')]);

    await performEffect(
      oystehr,
      oystehr,
      searchParams({
        checkNumber: 'CHK-100',
        eraDateFrom: '2026-07-01',
        eraStatus: 'complete',
      })
    );

    const scan = search.mock.calls.map((call) => call[0]).find(isScan)!;
    expect(paramValue(scan, 'created')).toBe('ge2026-07-01');
    expect(paramValue(scan, 'outcome')).toBe('complete');
  });

  it('lets the server paginate when no check number is given', async () => {
    const { oystehr, search } = makeOystehr([claimMdEra('era-1', 'CHK-100')]);

    const result = await performEffect(
      oystehr,
      oystehr,
      searchParams({
        offset: 25,
        pageSize: 25,
      })
    );

    expect(result.eras.map((era) => era.id)).toEqual(['era-1']);
    expect(search).toHaveBeenCalledTimes(1);
    const call = search.mock.calls[0][0];
    expect(paramValue(call, '_offset')).toBe('25');
    expect(paramValue(call, '_count')).toBe('25');
    expect(isScan(call)).toBe(false);
  });
});
