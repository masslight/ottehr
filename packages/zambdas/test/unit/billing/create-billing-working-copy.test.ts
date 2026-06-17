import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { index as rawIndex } from '../../../src/billing/create-billing-working-copy/index';
import { validateRequestParameters } from '../../../src/billing/create-billing-working-copy/validateRequestParameters';

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
    // Keep the working-copy transform trivial; its internals are tested elsewhere.
    prepareWorkingCopy: (resource: Record<string, unknown>) => ({ ...resource }),
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
  resourceType: 'Patient',
  resourceId: 'orig1',
};

describe('create-billing-working-copy', () => {
  describe('validateRequestParameters', () => {
    it('throws MISSING_REQUEST_BODY when the body is absent', () => {
      expect(() => validateRequestParameters(input(null))).toThrow(expect.objectContaining(MISSING_REQUEST_BODY));
    });

    it('throws MISSING_REQUEST_SECRETS when secrets are absent', () => {
      expect(() => validateRequestParameters(input('{}', null))).toThrow(
        expect.objectContaining(MISSING_REQUEST_SECRETS)
      );
    });

    it('throws INVALID_INPUT_ERROR on an unsupported resource type', () => {
      expect(() =>
        validateRequestParameters(
          input(
            JSON.stringify({
              resourceType: 'Bundle',
              resourceId: 'x',
            })
          )
        )
      ).toThrow(expect.objectContaining({ code: INVALID_INPUT_CODE }));
    });

    it('returns the parsed params plus secrets on a valid body', () => {
      expect(validateRequestParameters(input(JSON.stringify(validBody)))).toMatchObject({
        ...validBody,
        secrets: {},
      });
    });
  });

  describe('index', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('clones the original resource and returns the new id and resourceType', async () => {
      mockFetchById.mockResolvedValue({
        resourceType: 'Patient',
        id: 'original',
      });
      mockCreate.mockImplementation(async (resource) => ({
        ...resource,
        id: 'updated',
      }));

      const res = await index(input(JSON.stringify(validBody)));

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body)).toEqual({
        id: 'updated',
        resourceType: 'Patient',
      });
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ resourceType: 'Patient' }));
    });

    it('rejects invalid input before touching FHIR', async () => {
      await expect(index(input('{}'))).rejects.toMatchObject({ code: INVALID_INPUT_CODE });
      expect(mockFetchById).not.toHaveBeenCalled();
    });
  });
});
