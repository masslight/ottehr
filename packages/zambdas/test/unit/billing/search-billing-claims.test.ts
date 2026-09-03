import { APIGatewayProxyResult } from 'aws-lambda';
import { Claim, Resource } from 'fhir/r4b';
import { SearchBillingClaimsInput } from 'utils/lib/types/data/billing/billing.schemas';
import { SearchBillingClaimsResponse } from 'utils/lib/types/data/billing/billing.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ZambdaInput } from '../../../src/shared/types/common';

const mockOystehrClient = {
  fhir: {
    search: vi.fn(),
  },
  rcm: {
    listPayers: vi.fn(),
    getPayerByUrl: vi.fn(),
  },
};

vi.mock('../../../src/shared/auth', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('mock-token'),
}));

vi.mock('../../../src/shared/sentry', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  wrapHandler: (_name: string, fn: (...args: unknown[]) => unknown) => fn,
}));

vi.mock('../../../src/billing/shared', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    createBillingClient: vi.fn(() => mockOystehrClient),
  };
});

type ZambdaHandler = (input: ZambdaInput) => Promise<APIGatewayProxyResult>;

const makeInput = (body: SearchBillingClaimsInput): ZambdaInput => ({
  headers: null,
  body: JSON.stringify(body),
  secrets: {
    PROJECT_ID: 'test-project',
  },
});

type SearchParam = { name: string; value: string };

const bundleOf = (resources: Resource[], total = resources.length): any => ({
  resourceType: 'Bundle',
  type: 'searchset',
  total,
  entry: resources.map((resource) => ({
    resource,
    search: {
      mode: resource.resourceType === 'Claim' ? 'match' : 'include',
    },
  })),
  unbundle: () => resources,
});

const servicedClaim = (id: string, servicedDate: string): Claim =>
  ({
    resourceType: 'Claim',
    id,
    status: 'active',
    created: '2026-01-15',
    type: {
      coding: [],
    },
    insurance: [],
    total: {
      value: 100,
      currency: 'USD',
    },
    item: [
      {
        sequence: 1,
        servicedDate,
      },
    ],
    meta: {
      tag: [],
    },
  }) as unknown as Claim;

// The service date branch issues two shapes of Claim search: the id scan (no _include) and the page
// hydration (_id). Everything else is enrichment, which these tests leave empty.
const stubSearches = (scanClaims: Claim[], scanTotal = scanClaims.length): void => {
  mockOystehrClient.fhir.search.mockImplementation(async ({ resourceType, params }: any) => {
    const named = (name: string): string | undefined =>
      (params as SearchParam[] | undefined)?.find((param) => param.name === name)?.value;
    if (resourceType !== 'Claim') return bundleOf([]);
    if (named('_id')) {
      const ids = named('_id')!.split(',');
      return bundleOf(ids.map((id) => scanClaims.find((claim) => claim.id === id)).filter(Boolean) as Claim[]);
    }
    const offset = Number(named('_offset') ?? 0);
    const count = Number(named('_count') ?? scanClaims.length);
    return bundleOf(scanClaims.slice(offset, offset + count), scanTotal);
  });
};

const claimSearches = (): { params: SearchParam[] }[] =>
  mockOystehrClient.fhir.search.mock.calls
    .filter(([arg]) => arg.resourceType === 'Claim')
    .map(([arg]) => arg as { params: SearchParam[] });

const paramNamed = (params: SearchParam[], name: string): SearchParam | undefined =>
  params.find((param) => param.name === name);

const scanSearches = (): { params: SearchParam[] }[] =>
  claimSearches().filter(({ params }) => !paramNamed(params, '_id'));

const hydrationSearches = (): { params: SearchParam[] }[] =>
  claimSearches().filter(({ params }) => paramNamed(params, '_id'));

describe('search-billing-claims service date branch', () => {
  let handler!: ZambdaHandler;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    ({ index: handler } = (await import('../../../src/billing/search-billing-claims/index')) as {
      index: ZambdaHandler;
    });
  });

  const search = async (input: SearchBillingClaimsInput): Promise<SearchBillingClaimsResponse> => {
    const result = await handler(makeInput(input));
    expect(result.statusCode).toBe(200);
    return JSON.parse(result.body) as SearchBillingClaimsResponse;
  };

  // Claim has no service-date search parameter, so the filter runs in memory. Dragging the four
  // includes and every claim field through that scan is what exceeded the response size limit.
  it('scans for ids without the includes, and hydrates only the page it settles on', async () => {
    stubSearches([servicedClaim('claim-1', '2026-01-10'), servicedClaim('claim-2', '2026-01-11')]);

    const response = await search({
      serviceDateFrom: '2026-01-01',
      serviceDateTo: '2026-01-31',
    });

    expect(response.claims.map((claim) => claim.id)).toEqual(['claim-1', 'claim-2']);
    expect(scanSearches()).toHaveLength(1);
    const [{ params }] = scanSearches();
    expect(paramNamed(params, '_include')).toBeUndefined();
    expect(paramNamed(params, '_elements')?.value).toBe('id,meta,created,item');

    expect(hydrationSearches()).toHaveLength(1);
    expect(paramNamed(hydrationSearches()[0].params, '_id')?.value).toBe('claim-1,claim-2');
  });

  it('hydrates only the requested page of a larger match set', async () => {
    stubSearches([
      servicedClaim('claim-1', '2026-01-10'),
      servicedClaim('claim-2', '2026-01-11'),
      servicedClaim('claim-3', '2026-01-12'),
    ]);

    const response = await search({
      serviceDateFrom: '2026-01-01',
      serviceDateTo: '2026-01-31',
      offset: 1,
      pageSize: 1,
    });

    expect(response.total).toBe(3);
    expect(response.claims.map((claim) => claim.id)).toEqual(['claim-2']);
    expect(paramNamed(hydrationSearches()[0].params, '_id')?.value).toBe('claim-2');
  });

  it('drops claims whose service date falls outside the range', async () => {
    stubSearches([servicedClaim('in-range', '2026-01-10'), servicedClaim('out-of-range', '2026-03-10')]);

    const response = await search({
      serviceDateFrom: '2026-01-01',
      serviceDateTo: '2026-01-31',
    });

    expect(response.claims.map((claim) => claim.id)).toEqual(['in-range']);
    expect(response.total).toBe(1);
  });

  it('reports a complete result when the scan saw every match', async () => {
    stubSearches([servicedClaim('claim-1', '2026-01-10')]);

    const response = await search({
      serviceDateFrom: '2026-01-01',
      serviceDateTo: '2026-01-31',
    });

    expect(response.incomplete).toBe(false);
  });

  // Without a ceiling the scan holds every match in memory at once, so a wide range fills the lambda
  // rather than returning anything at all.
  it('flags the result incomplete when the server had more matches than the scan collected', async () => {
    stubSearches([servicedClaim('claim-1', '2026-01-10')], 50_000);

    const response = await search({
      serviceDateFrom: '2026-01-01',
      serviceDateTo: '2026-01-31',
    });

    expect(response.incomplete).toBe(true);
  });

  it('leaves a search with no service date on the server-paginated path', async () => {
    stubSearches([servicedClaim('claim-1', '2026-01-10')]);

    await search({
      pageSize: 25,
    });

    expect(claimSearches()).toHaveLength(1);
    const [{ params }] = claimSearches();
    expect(paramNamed(params, '_include')).toBeDefined();
    expect(paramNamed(params, '_offset')?.value).toBe('0');
    expect(paramNamed(params, '_count')?.value).toBe('25');
  });
});
