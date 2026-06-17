import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { index as rawIndex } from '../../../src/billing/create-billing-claim/index';
import { validateRequestParameters } from '../../../src/billing/create-billing-claim/validateRequestParameters';

const { mockTransaction, mockSearch, mockCreate } = vi.hoisted(() => ({
  mockTransaction: vi.fn(),
  mockSearch: vi.fn(),
  mockCreate: vi.fn(),
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
    getResourcesFromBatchInlineRequests: vi.fn().mockResolvedValue([
      {
        resourceType: 'Patient',
        id: 'p1',
      },
    ]),
  };
});

vi.mock('../../../src/billing/shared', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    createBillingClient: () => ({
      fhir: {
        transaction: mockTransaction,
        search: mockSearch,
        create: mockCreate,
        patch: vi.fn(),
      },
    }),
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

describe('create-billing-claim', () => {
  describe('validateRequestParameters', () => {
    it('throws MISSING_REQUEST_BODY when the body is absent', () => {
      expect(() => validateRequestParameters(input(null))).toThrow(expect.objectContaining(MISSING_REQUEST_BODY));
    });

    it('throws MISSING_REQUEST_SECRETS when secrets are absent', () => {
      expect(() => validateRequestParameters(input('{}', null))).toThrow(
        expect.objectContaining(MISSING_REQUEST_SECRETS)
      );
    });

    it('throws INVALID_INPUT_ERROR when patientId is missing', () => {
      expect(() => validateRequestParameters(input('{}'))).toThrow(
        expect.objectContaining({ code: INVALID_INPUT_CODE })
      );
    });

    it('returns the parsed params plus secrets on a valid body', () => {
      expect(validateRequestParameters(input(JSON.stringify({ patientId: 'p1' })))).toEqual({
        patientId: 'p1',
        secrets: {},
      });
    });
  });

  describe('index', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockSearch.mockResolvedValue({ unbundle: () => [] });
    });

    it('creates working copies and a claim, returning the new claim id', async () => {
      mockTransaction.mockResolvedValue({
        entry: [
          {
            resource: {
              resourceType: 'Patient',
              id: 'pc1',
            },
          },
        ],
      });
      mockCreate.mockImplementation(async (resource) => ({
        ...resource,
        id: 'claim1',
      }));

      const res = await index(input(JSON.stringify({ patientId: 'p1' })));

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ claimId: 'claim1' });
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ resourceType: 'Claim' }));
    });

    it('rejects invalid input before touching FHIR', async () => {
      await expect(index(input('{}'))).rejects.toMatchObject({ code: INVALID_INPUT_CODE });
      expect(mockTransaction).not.toHaveBeenCalled();
    });
  });
});
