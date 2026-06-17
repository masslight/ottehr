import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { index as rawIndex } from '../../../src/billing/get-billing-era-detail/index';
import { validateRequestParameters } from '../../../src/billing/get-billing-era-detail/validateRequestParameters';

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

describe('get-billing-era-detail', () => {
  describe('validateRequestParameters', () => {
    it('throws MISSING_REQUEST_BODY when the body is absent', () => {
      expect(() => validateRequestParameters(input(null))).toThrow(expect.objectContaining(MISSING_REQUEST_BODY));
    });

    it('throws MISSING_REQUEST_SECRETS when secrets are absent', () => {
      expect(() => validateRequestParameters(input('{}', null))).toThrow(
        expect.objectContaining(MISSING_REQUEST_SECRETS)
      );
    });

    it('throws INVALID_INPUT_ERROR when eraId is missing', () => {
      expect(() => validateRequestParameters(input('{}'))).toThrow(
        expect.objectContaining({ code: INVALID_INPUT_CODE })
      );
    });

    it('returns the parsed params plus secrets on a valid body', () => {
      expect(validateRequestParameters(input(JSON.stringify({ eraId: 'era1' })))).toEqual({
        eraId: 'era1',
        secrets: {},
      });
    });
  });

  describe('index', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockResolvePayers.mockResolvedValue(new Map());
    });

    it('maps the payment reconciliation into an ERA detail', async () => {
      mockSearch.mockResolvedValue({
        unbundle: () => [
          {
            id: 'era1',
            identifier: [],
            detail: [],
            paymentAmount: { value: 100 },
            paymentDate: '2026-01-01',
            outcome: 'complete',
          },
        ],
      });

      const res = await index(input(JSON.stringify({ eraId: 'era1' })));

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body).toMatchObject({
        id: 'era1',
        checkAmount: 100,
        status: 'complete',
      });
      expect(body.claims).toEqual([]);
    });

    it('rejects invalid input before touching FHIR', async () => {
      await expect(index(input('{}'))).rejects.toMatchObject({ code: INVALID_INPUT_CODE });
      expect(mockSearch).not.toHaveBeenCalled();
    });
  });
});
