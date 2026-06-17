import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { index as rawIndex } from '../../../src/billing/delete-billing-tag/index';
import { validateRequestParameters } from '../../../src/billing/delete-billing-tag/validateRequestParameters';

const { mockSearch, mockDelete } = vi.hoisted(() => ({
  mockSearch: vi.fn(),
  mockDelete: vi.fn(),
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
    createBillingClient: () => ({
      fhir: {
        search: mockSearch,
        delete: mockDelete,
      },
    }),
  };
});

const index = rawIndex as unknown as (input: any) => Promise<{ statusCode: number; body: string }>;

const INVALID_INPUT_CODE = INVALID_INPUT_ERROR('x').code;
const input = (body: string | null, secrets: unknown = {}): any => ({
  headers: {},
  body,
  secrets,
});

describe('delete-billing-tag', () => {
  describe('validateRequestParameters', () => {
    it('throws MISSING_REQUEST_BODY when the body is absent', () => {
      expect(() => validateRequestParameters(input(null))).toThrow(expect.objectContaining(MISSING_REQUEST_BODY));
    });

    it('throws MISSING_REQUEST_SECRETS when secrets are absent', () => {
      expect(() => validateRequestParameters(input('{}', null))).toThrow(
        expect.objectContaining(MISSING_REQUEST_SECRETS)
      );
    });

    it('throws INVALID_INPUT_ERROR on an invalid body', () => {
      expect(() => validateRequestParameters(input('{}'))).toThrow(
        expect.objectContaining({ code: INVALID_INPUT_CODE })
      );
    });

    it('returns the parsed params plus secrets on a valid body', () => {
      expect(validateRequestParameters(input(JSON.stringify({ tagId: 't1' })))).toEqual({
        tagId: 't1',
        secrets: {},
      });
    });
  });

  describe('index', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('deletes an unused, non-system tag and returns { deleted: true }', async () => {
      const tag = {
        resourceType: 'Basic',
        id: 't1',
        code: {
          text: 'Overdue',
          coding: [
            {
              system: 'https://ottehr.com/billing/tag',
              code: 'tag',
            },
          ],
        },
      };
      mockSearch.mockResolvedValueOnce({ unbundle: () => [tag] }).mockResolvedValueOnce({
        total: 0,
        unbundle: () => [],
      });
      mockDelete.mockResolvedValue({});

      const res = await index(input(JSON.stringify({ tagId: 't1' })));

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ deleted: true });
      expect(mockDelete).toHaveBeenCalledWith({
        resourceType: 'Basic',
        id: 't1',
      });
    });

    it('rejects when the tag is still associated with claims', async () => {
      const tag = {
        resourceType: 'Basic',
        id: 't1',
        code: {
          text: 'Overdue',
        },
      };
      mockSearch.mockResolvedValueOnce({ unbundle: () => [tag] }).mockResolvedValueOnce({
        total: 2,
        unbundle: () => [],
      });

      await expect(index(input(JSON.stringify({ tagId: 't1' })))).rejects.toMatchObject({ code: INVALID_INPUT_CODE });
      expect(mockDelete).not.toHaveBeenCalled();
    });

    it('rejects invalid input before touching FHIR', async () => {
      await expect(index(input('{}'))).rejects.toMatchObject({ code: INVALID_INPUT_CODE });
      expect(mockSearch).not.toHaveBeenCalled();
    });
  });
});
