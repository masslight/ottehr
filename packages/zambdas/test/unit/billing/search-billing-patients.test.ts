import { INVALID_INPUT_ERROR, MISSING_REQUEST_SECRETS } from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { index as rawIndex } from '../../../src/billing/search-billing-patients/index';
import { validateRequestParameters } from '../../../src/billing/search-billing-patients/validateRequestParameters';

const { mockSearch } = vi.hoisted(() => ({ mockSearch: vi.fn() }));

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
  };
});

const index = rawIndex as unknown as (input: any) => Promise<{ statusCode: number; body: string }>;

const INVALID_INPUT_CODE = INVALID_INPUT_ERROR('x').code;
const input = (body: string | null, secrets: unknown = {}): any => ({
  headers: {},
  body,
  secrets,
});

describe('search-billing-patients', () => {
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
      expect(validateRequestParameters(input(JSON.stringify({ name: 'doe' })))).toEqual({
        name: 'doe',
        secrets: {},
      });
    });

    it('throws INVALID_INPUT_ERROR on a malformed uuid filter', () => {
      expect(() => validateRequestParameters(input(JSON.stringify({ uuid: 'not-a-uuid' })))).toThrow(
        expect.objectContaining({ code: INVALID_INPUT_CODE })
      );
    });
  });

  describe('index', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('maps and paginates the matched patients', async () => {
      mockSearch.mockResolvedValue({
        total: 1,
        unbundle: () => [
          {
            id: 'p1',
            name: [
              {
                given: ['Jane'],
                family: 'Doe',
              },
            ],
            birthDate: '1990-01-01',
          },
        ],
      });

      const res = await index(input(JSON.stringify({ name: 'doe' })));

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body).toMatchObject({
        total: 1,
        offset: 0,
        pageSize: 25,
      });
      expect(body.patients).toHaveLength(1);
      expect(body.patients[0]).toMatchObject({
        id: 'p1',
        firstName: 'Jane',
        lastName: 'Doe',
        dob: '1990-01-01',
      });
    });
  });
});
