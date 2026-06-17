import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { index as rawIndex } from '../../../src/billing/get-billing-patient-detail/index';
import { validateRequestParameters } from '../../../src/billing/get-billing-patient-detail/validateRequestParameters';

const { mockSearch, mockFetchById, mockResolvePayers } = vi.hoisted(() => ({
  mockSearch: vi.fn(),
  mockFetchById: vi.fn(),
  mockResolvePayers: vi.fn(),
}));

vi.mock('../../../src/shared', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    wrapHandler: (_name: string, handler: unknown) => handler,
    checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('m2m-token'),
    fetchAllPages: async (cb: (offset: number, count: number) => Promise<unknown>) => {
      await cb(0, 100);
    },
  };
});

vi.mock('../../../src/billing/shared', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    createBillingClient: () => ({ fhir: { search: mockSearch } }),
    fetchById: mockFetchById,
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

describe('get-billing-patient-detail', () => {
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
      mockResolvePayers.mockResolvedValue(new Map());
      mockSearch.mockResolvedValue({ unbundle: () => [] });
    });

    it('maps the patient demographics with no claims', async () => {
      mockFetchById.mockResolvedValue({
        resourceType: 'Patient',
        id: 'p1',
        name: [
          {
            given: ['Jane'],
            family: 'Doe',
          },
        ],
        birthDate: '1990-01-01',
      });

      const res = await index(input(JSON.stringify({ patientId: 'p1' })));

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body).toMatchObject({
        id: 'p1',
        firstName: 'Jane',
        lastName: 'Doe',
        dob: '1990-01-01',
      });
      expect(body.claims).toEqual([]);
    });

    it('rejects invalid input before touching FHIR', async () => {
      await expect(index(input('{}'))).rejects.toMatchObject({ code: INVALID_INPUT_CODE });
      expect(mockFetchById).not.toHaveBeenCalled();
    });
  });
});
