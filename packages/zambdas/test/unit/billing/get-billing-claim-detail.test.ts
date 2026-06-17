import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { index as rawIndex } from '../../../src/billing/get-billing-claim-detail/index';
import { validateRequestParameters } from '../../../src/billing/get-billing-claim-detail/validateRequestParameters';

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

vi.mock('utils', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    getResourcesFromBatchInlineRequests: vi.fn().mockResolvedValue([]),
  };
});

vi.mock('../../../src/billing/shared', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    createBillingClient: () => ({ fhir: { search: mockSearch } }),
    resolvePayersByRef: mockResolvePayers,
    getClaimType: () => 'professional',
    getClaimStatus: () => 'submitted',
  };
});

const index = rawIndex as unknown as (input: any) => Promise<{ statusCode: number; body: string }>;

const INVALID_INPUT_CODE = INVALID_INPUT_ERROR('x').code;
const input = (body: string | null, secrets: unknown = {}): any => ({
  headers: {},
  body,
  secrets,
});

describe('get-billing-claim-detail', () => {
  describe('validateRequestParameters', () => {
    it('throws MISSING_REQUEST_BODY when the body is absent', () => {
      expect(() => validateRequestParameters(input(null))).toThrow(expect.objectContaining(MISSING_REQUEST_BODY));
    });

    it('throws MISSING_REQUEST_SECRETS when secrets are absent', () => {
      expect(() => validateRequestParameters(input('{}', null))).toThrow(
        expect.objectContaining(MISSING_REQUEST_SECRETS)
      );
    });

    it('throws INVALID_INPUT_ERROR when claimId is missing', () => {
      expect(() => validateRequestParameters(input('{}'))).toThrow(
        expect.objectContaining({ code: INVALID_INPUT_CODE })
      );
    });

    it('returns the parsed params plus secrets on a valid body', () => {
      expect(validateRequestParameters(input(JSON.stringify({ claimId: 'c1' })))).toEqual({
        claimId: 'c1',
        secrets: {},
      });
    });
  });

  describe('index', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockResolvePayers.mockResolvedValue(new Map());
    });

    it('maps a claim with no linked resources into a claim detail', async () => {
      const claim = {
        resourceType: 'Claim',
        id: 'c1',
        created: '2026-01-01',
        insurance: [],
        item: [],
        diagnosis: [],
        total: {
          value: 50,
        },
        meta: {
          tag: [],
        },
      };
      mockSearch.mockImplementation(async ({ resourceType }: { resourceType: string }) =>
        resourceType === 'Claim'
          ? {
              entry: [
                {
                  resource: claim,
                },
              ],
            }
          : { unbundle: () => [] }
      );

      const res = await index(input(JSON.stringify({ claimId: 'c1' })));

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body).toMatchObject({
        id: 'c1',
        type: 'professional',
        status: 'submitted',
        billed: 50,
      });
    });

    it('rejects invalid input before touching FHIR', async () => {
      await expect(index(input('{}'))).rejects.toMatchObject({ code: INVALID_INPUT_CODE });
      expect(mockSearch).not.toHaveBeenCalled();
    });
  });
});
