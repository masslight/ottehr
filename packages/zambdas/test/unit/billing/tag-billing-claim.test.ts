import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { index as rawIndex } from '../../../src/billing/tag-billing-claim/index';
import { validateRequestParameters } from '../../../src/billing/tag-billing-claim/validateRequestParameters';

const { mockPatch, mockFetchById } = vi.hoisted(() => ({
  mockPatch: vi.fn(),
  mockFetchById: vi.fn(),
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
    createBillingClient: () => ({ fhir: { patch: mockPatch } }),
    fetchById: mockFetchById,
  };
});

const index = rawIndex as unknown as (input: any) => Promise<{ statusCode: number; body: string }>;

const INVALID_INPUT_CODE = INVALID_INPUT_ERROR('x').code;
const input = (body: string | null, secrets: unknown = {}): any => ({
  headers: {},
  body,
  secrets,
});
const validBody = {
  claimId: 'c1',
  action: 'add',
  tagName: 'urgent',
};

describe('tag-billing-claim', () => {
  describe('validateRequestParameters', () => {
    it('throws MISSING_REQUEST_BODY when the body is absent', () => {
      expect(() => validateRequestParameters(input(null))).toThrow(expect.objectContaining(MISSING_REQUEST_BODY));
    });

    it('throws MISSING_REQUEST_SECRETS when secrets are absent', () => {
      expect(() => validateRequestParameters(input('{}', null))).toThrow(
        expect.objectContaining(MISSING_REQUEST_SECRETS)
      );
    });

    it('throws INVALID_INPUT_ERROR on an invalid action', () => {
      expect(() =>
        validateRequestParameters(
          input(
            JSON.stringify({
              claimId: 'c1',
              action: 'nope',
              tagName: 't',
            })
          )
        )
      ).toThrow(expect.objectContaining({ code: INVALID_INPUT_CODE }));
    });

    it('returns the parsed params plus secrets on a valid body', () => {
      expect(validateRequestParameters(input(JSON.stringify(validBody)))).toEqual({
        ...validBody,
        secrets: {},
      });
    });
  });

  describe('index', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('adds a tag to a claim that does not yet have it and returns { ok: true }', async () => {
      mockFetchById.mockResolvedValue({
        resourceType: 'Claim',
        id: 'c1',
        meta: {
          tag: [],
          versionId: '7',
        },
      });
      mockPatch.mockResolvedValue({});

      const res = await index(input(JSON.stringify(validBody)));

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ ok: true });
      expect(mockPatch).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceType: 'Claim',
          id: 'c1',
          operations: [
            {
              op: 'add',
              path: '/meta/tag',
              value: [
                {
                  system: 'https://ottehr.com/billing/claim-tag',
                  code: 'urgent',
                },
              ],
            },
          ],
        }),
        { optimisticLockingVersionId: '7' }
      );
    });

    it('does not patch when the tag already exists', async () => {
      mockFetchById.mockResolvedValue({
        resourceType: 'Claim',
        id: 'c1',
        meta: {
          tag: [
            {
              system: 'https://ottehr.com/billing/claim-tag',
              code: 'urgent',
            },
          ],
        },
      });

      const res = await index(input(JSON.stringify(validBody)));

      expect(res.statusCode).toBe(200);
      expect(mockPatch).not.toHaveBeenCalled();
    });

    it('rejects invalid input before touching FHIR', async () => {
      await expect(index(input('{}'))).rejects.toMatchObject({ code: INVALID_INPUT_CODE });
      expect(mockFetchById).not.toHaveBeenCalled();
    });
  });
});
