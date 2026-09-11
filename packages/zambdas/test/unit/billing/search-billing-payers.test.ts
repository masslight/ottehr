import { APIGatewayProxyResult } from 'aws-lambda';
import { Organization } from 'fhir/r4b';
import { SearchBillingPayersInput } from 'utils/lib/types/data/billing/billing.schemas';
import { SearchBillingPayersResponse } from 'utils/lib/types/data/billing/billing.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ZambdaInput } from '../../../src/shared/types/common';

const mockOystehrClient = {
  rcm: {
    listPayers: vi.fn(),
    getPayer: vi.fn(),
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

const makeInput = (body: SearchBillingPayersInput): ZambdaInput => ({
  headers: null,
  body: JSON.stringify(body),
  secrets: {
    PROJECT_ID: 'test-project',
  },
});

const payerOrg = (id: string, name: string, payerId: string): Organization => ({
  resourceType: 'Organization',
  id,
  name,
  identifier: [{ system: 'https://identifiers.fhir.oystehr.com/rcm-payer-id', value: payerId }],
});

describe('search-billing-payers', () => {
  let handler!: ZambdaHandler;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    ({ index: handler } = (await import('../../../src/billing/search-billing-payers/index')) as {
      index: ZambdaHandler;
    });
  });

  const search = async (input: SearchBillingPayersInput): Promise<SearchBillingPayersResponse> => {
    const result = await handler(makeInput(input));
    expect(result.statusCode).toBe(200);
    return JSON.parse(result.body) as SearchBillingPayersResponse;
  };

  describe('plain listing (no name/payerId filter)', () => {
    it('pages through the RCM directory via listPayers, sorted by name, and surfaces nextCursor', async () => {
      mockOystehrClient.rcm.listPayers.mockResolvedValue({
        data: [payerOrg('org-1', 'Aetna', 'AET01'), payerOrg('org-2', 'Cigna', 'CIG01')],
        metadata: { nextCursor: 'cursor-2' },
      });

      const response = await search({});

      expect(mockOystehrClient.rcm.listPayers).toHaveBeenCalledExactlyOnceWith({
        limit: 50,
        sort: 'name',
        sortOrder: 'asc',
      });
      expect(response.payers.map((p) => p.id)).toEqual(['org-1', 'org-2']);
      expect(response.nextCursor).toBe('cursor-2');
    });

    it('forwards the caller-supplied cursor and limit to listPayers', async () => {
      mockOystehrClient.rcm.listPayers.mockResolvedValue({
        data: [payerOrg('org-3', 'Humana', 'HUM01')],
        metadata: { nextCursor: null },
      });

      const response = await search({ cursor: 'cursor-2', limit: 10 });

      expect(mockOystehrClient.rcm.listPayers).toHaveBeenCalledExactlyOnceWith({
        cursor: 'cursor-2',
        limit: 10,
        sort: 'name',
        sortOrder: 'asc',
      });
      expect(response.payers.map((p) => p.id)).toEqual(['org-3']);
      expect(response.nextCursor).toBeNull();
    });

    it('reports no further pages once listPayers returns a null cursor', async () => {
      mockOystehrClient.rcm.listPayers.mockResolvedValue({
        data: [],
        metadata: { nextCursor: null },
      });

      const response = await search({ cursor: 'cursor-last' });

      expect(response.payers).toEqual([]);
      expect(response.nextCursor).toBeNull();
    });
  });

  describe('payerId lookup', () => {
    it('resolves a single payer and does not touch the directory listing', async () => {
      mockOystehrClient.rcm.getPayer.mockResolvedValue(payerOrg('org-1', 'Aetna', 'AET01'));

      const response = await search({ payerId: 'org-1' });

      expect(mockOystehrClient.rcm.getPayer).toHaveBeenCalledExactlyOnceWith({ id: 'org-1' });
      expect(mockOystehrClient.rcm.listPayers).not.toHaveBeenCalled();
      expect(response.payers).toEqual([{ id: 'org-1', name: 'Aetna', payerId: 'AET01' }]);
    });

    it('returns an empty list, not the unrelated directory, when the id misses', async () => {
      mockOystehrClient.rcm.getPayer.mockResolvedValue(undefined);

      const response = await search({ payerId: 'unknown-id' });

      expect(response.payers).toEqual([]);
      expect(mockOystehrClient.rcm.listPayers).not.toHaveBeenCalled();
    });
  });

  describe('name search (typeahead)', () => {
    it('merges name and id matches, de-duplicated by payer id', async () => {
      mockOystehrClient.rcm.listPayers.mockImplementation(async ({ name, id }: { name?: string; id?: string }) => {
        if (name) {
          return { data: [payerOrg('org-1', 'Aetna', 'AET01')], metadata: { nextCursor: null } };
        }
        if (id) {
          return {
            data: [payerOrg('org-1', 'Aetna', 'AET01'), payerOrg('org-2', 'Aetna Better Health', 'AET02')],
            metadata: { nextCursor: null },
          };
        }
        throw new Error('expected name or id');
      });

      const response = await search({ name: 'Aetna' });

      expect(mockOystehrClient.rcm.listPayers).toHaveBeenCalledWith({ name: 'Aetna', limit: 50 });
      expect(mockOystehrClient.rcm.listPayers).toHaveBeenCalledWith({ id: 'Aetna', limit: 50 });
      expect(response.payers.map((p) => p.id).sort()).toEqual(['org-1', 'org-2']);
      expect(response.nextCursor).toBeUndefined();
    });
  });
});
