import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { index as rawIndex } from '../../../src/billing/update-billing-patient/index';
import { validateRequestParameters } from '../../../src/billing/update-billing-patient/validateRequestParameters';

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
    createBillingClient: () => ({
      fhir: {
        update: mockUpdate,
      },
    }),
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
  patientId: 'p1',
  firstName: 'Jane',
  lastName: 'Doe',
};

describe('update-billing-patient', () => {
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

    it('overwrites the prior name on the fetched patient and returns its id', async () => {
      mockFetchById.mockResolvedValue({
        resourceType: 'Patient',
        id: 'p1',
        name: [
          {
            family: 'Old',
            given: ['Name'],
          },
        ],
      });
      mockUpdate.mockImplementation(async (resource) => resource);

      const res = await index(input(JSON.stringify(validBody)));

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ id: 'p1' });
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceType: 'Patient',
          id: 'p1',
          name: [
            {
              family: 'Doe',
              given: ['Jane'],
            },
          ],
        })
      );
    });

    it('rejects invalid input before touching FHIR', async () => {
      await expect(index(input('{}'))).rejects.toMatchObject({ code: INVALID_INPUT_CODE });
      expect(mockFetchById).not.toHaveBeenCalled();
    });
  });
});
