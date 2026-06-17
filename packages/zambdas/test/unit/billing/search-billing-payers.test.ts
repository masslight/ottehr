import { INVALID_INPUT_ERROR, MISSING_REQUEST_SECRETS } from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { index as rawIndex } from '../../../src/billing/search-billing-payers/index';
import { validateRequestParameters } from '../../../src/billing/search-billing-payers/validateRequestParameters';

const { mockListPayers } = vi.hoisted(() => ({ mockListPayers: vi.fn() }));

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
    createBillingClient: () => ({ rcm: { listPayers: mockListPayers } }),
  };
});

const index = rawIndex as unknown as (input: any) => Promise<{ statusCode: number; body: string }>;

const INVALID_INPUT_CODE = INVALID_INPUT_ERROR('x').code;
const input = (body: string | null, secrets: unknown = {}): any => ({
  headers: {},
  body,
  secrets,
});

describe('search-billing-payers', () => {
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
      expect(validateRequestParameters(input(JSON.stringify({ name: 'Aetna' })))).toEqual({
        name: 'Aetna',
        secrets: {},
      });
    });

    it('throws INVALID_INPUT_ERROR on an invalid filter', () => {
      expect(() => validateRequestParameters(input(JSON.stringify({ name: '' })))).toThrow(
        expect.objectContaining({ code: INVALID_INPUT_CODE })
      );
    });
  });

  describe('index', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('maps payers from the RCM payer list', async () => {
      mockListPayers.mockResolvedValue({
        data: [
          {
            id: 'pa1',
            name: 'Aetna',
          },
        ],
      });

      const res = await index(input(JSON.stringify({ name: 'Aetna' })));

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.payers).toHaveLength(1);
      expect(body.payers[0]).toMatchObject({
        id: 'pa1',
        name: 'Aetna',
      });
    });
  });
});
