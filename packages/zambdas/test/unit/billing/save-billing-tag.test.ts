import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { index as rawIndex } from '../../../src/billing/save-billing-tag/index';
import { validateRequestParameters } from '../../../src/billing/save-billing-tag/validateRequestParameters';

const { mockCreate, mockFetchById } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
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
    createBillingClient: () => ({ fhir: { create: mockCreate } }),
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

describe('save-billing-tag', () => {
  describe('validateRequestParameters', () => {
    it('throws MISSING_REQUEST_BODY when the body is absent', () => {
      expect(() => validateRequestParameters(input(null))).toThrow(expect.objectContaining(MISSING_REQUEST_BODY));
    });

    it('throws MISSING_REQUEST_SECRETS when secrets are absent', () => {
      expect(() => validateRequestParameters(input('{}', null))).toThrow(
        expect.objectContaining(MISSING_REQUEST_SECRETS)
      );
    });

    it('throws INVALID_INPUT_ERROR when name is missing', () => {
      expect(() => validateRequestParameters(input('{}'))).toThrow(
        expect.objectContaining({ code: INVALID_INPUT_CODE })
      );
    });

    it('returns the parsed params plus secrets on a valid body', () => {
      expect(validateRequestParameters(input(JSON.stringify({ name: 'Overdue' })))).toEqual({
        name: 'Overdue',
        secrets: {},
      });
    });
  });

  describe('index', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('creates a new tag with the supplied name when no tagId is supplied and returns the assigned id', async () => {
      mockCreate.mockImplementation(async (resource) => ({
        ...resource,
        id: 'tag-1',
      }));

      const res = await index(input(JSON.stringify({ name: 'Overdue' })));

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ id: 'tag-1' });
      expect(mockFetchById).not.toHaveBeenCalled();
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceType: 'Basic',
          code: expect.objectContaining({ text: 'Overdue' }),
        })
      );
    });

    it('rejects invalid input before creating anything', async () => {
      await expect(index(input('{}'))).rejects.toMatchObject({ code: INVALID_INPUT_CODE });
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });
});
