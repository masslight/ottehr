import { INVALID_INPUT_ERROR, MISSING_REQUEST_SECRETS } from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { index as rawIndex } from '../../../src/billing/search-billing-claims/index';
import { validateRequestParameters } from '../../../src/billing/search-billing-claims/validateRequestParameters';

const { mockSearch, mockResolvePayers } = vi.hoisted(() => ({
  mockSearch: vi.fn(),
  mockResolvePayers: vi.fn(),
}));

vi.mock('../../../src/shared', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    wrapHandler: (_name: string, handler: unknown) => handler,
    checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('m2m-token'),
  };
});

vi.mock('../../../src/billing/shared', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    createBillingClient: () => ({ fhir: { search: mockSearch } }),
    resolvePayersByRef: mockResolvePayers,
  };
});

const index = rawIndex as unknown as (input: any) => Promise<{ statusCode: number; body: string }>;

const INVALID_INPUT_CODE = INVALID_INPUT_ERROR('x').code;
const input = (body: string | null, secrets: unknown = {}): any => ({
  headers: {},
  body,
  secrets,
});

describe('search-billing-claims', () => {
  describe('validateRequestParameters', () => {
    it('throws MISSING_REQUEST_SECRETS when secrets are absent', () => {
      expect(() => validateRequestParameters(input('{}', null))).toThrow(
        expect.objectContaining(MISSING_REQUEST_SECRETS)
      );
    });

    it('returns only secrets when no body is provided', () => {
      expect(validateRequestParameters(input(null))).toEqual({ secrets: {} });
    });

    it('returns parsed filters plus secrets on a valid body', () => {
      expect(validateRequestParameters(input(JSON.stringify({ patientId: 'p1' })))).toEqual({
        patientId: 'p1',
        secrets: {},
      });
    });

    it('throws INVALID_INPUT_ERROR on an invalid filter value', () => {
      expect(() => validateRequestParameters(input(JSON.stringify({ offset: -1 })))).toThrow(
        expect.objectContaining({ code: INVALID_INPUT_CODE })
      );
    });
  });

  describe('index', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockResolvePayers.mockResolvedValue(new Map());
    });

    it('returns an empty, paginated claim list when nothing matches', async () => {
      mockSearch.mockResolvedValue({
        total: 0,
        entry: [],
      });

      const res = await index(input(JSON.stringify({ patientId: 'p1' })));

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body)).toMatchObject({
        claims: [],
        total: 0,
        offset: 0,
        pageSize: 25,
      });
    });
  });
});
