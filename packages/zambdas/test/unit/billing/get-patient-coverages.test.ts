import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { index as rawIndex } from '../../../src/billing/get-patient-coverages/index';
import { validateRequestParameters } from '../../../src/billing/get-patient-coverages/validateRequestParameters';

const { mockSearch, mockResolvePayers } = vi.hoisted(() => ({
  mockSearch: vi.fn(),
  mockResolvePayers: vi.fn(),
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
    createBillingClient: () => ({ fhir: { search: mockSearch } }),
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

describe('get-patient-coverages', () => {
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
    });

    it('returns the mapped coverages for the patient', async () => {
      mockSearch.mockResolvedValue({
        unbundle: () => [
          {
            id: 'cov1',
            status: 'active',
            subscriberId: 'S1',
            payor: [{ reference: 'Organization/o1' }],
          },
        ],
      });
      mockResolvePayers.mockResolvedValue(
        new Map([
          [
            'Organization/o1',
            {
              id: 'o1',
              name: 'Aetna',
            },
          ],
        ])
      );

      const res = await index(input(JSON.stringify({ patientId: 'p1' })));

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.coverages).toHaveLength(1);
      expect(body.coverages[0]).toMatchObject({
        id: 'cov1',
        status: 'active',
        subscriberId: 'S1',
        payorName: 'Aetna',
      });
    });

    it('rejects invalid input before touching FHIR', async () => {
      await expect(index(input('{}'))).rejects.toMatchObject({ code: INVALID_INPUT_CODE });
      expect(mockSearch).not.toHaveBeenCalled();
    });
  });
});
