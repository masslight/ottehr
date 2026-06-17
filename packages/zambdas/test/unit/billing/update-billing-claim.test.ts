import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { index as rawIndex } from '../../../src/billing/update-billing-claim/index';
import { validateRequestParameters } from '../../../src/billing/update-billing-claim/validateRequestParameters';

const { mockUpdate, mockFetchById } = vi.hoisted(() => ({
  mockUpdate: vi.fn(),
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
    createBillingClient: () => ({ fhir: { update: mockUpdate } }),
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
  resourceType: 'Coverage',
  resourceId: 'cov1',
  fields: { subscriberId: 'S9' },
};

describe('update-billing-claim', () => {
  describe('validateRequestParameters', () => {
    it('throws MISSING_REQUEST_BODY when the body is absent', () => {
      expect(() => validateRequestParameters(input(null))).toThrow(expect.objectContaining(MISSING_REQUEST_BODY));
    });

    it('throws MISSING_REQUEST_SECRETS when secrets are absent', () => {
      expect(() => validateRequestParameters(input('{}', null))).toThrow(
        expect.objectContaining(MISSING_REQUEST_SECRETS)
      );
    });

    it('throws INVALID_INPUT_ERROR on an unknown resourceType', () => {
      expect(() => validateRequestParameters(input('{}'))).toThrow(
        expect.objectContaining({ code: INVALID_INPUT_CODE })
      );
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

    it('applies the changed field while preserving untouched fields, and returns its id', async () => {
      mockFetchById.mockResolvedValue({
        resourceType: 'Coverage',
        id: 'cov1',
        status: 'active',
        subscriberId: 'OLD',
      });
      mockUpdate.mockImplementation(async (resource) => resource);

      const res = await index(input(JSON.stringify(validBody)));

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ id: 'cov1' });
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceType: 'Coverage',
          id: 'cov1',
          subscriberId: 'S9',
          status: 'active',
        })
      );
    });

    it('rejects invalid input before touching FHIR', async () => {
      await expect(index(input('{}'))).rejects.toMatchObject({ code: INVALID_INPUT_CODE });
      expect(mockFetchById).not.toHaveBeenCalled();
    });
  });
});
