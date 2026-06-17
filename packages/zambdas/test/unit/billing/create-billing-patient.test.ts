import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { index as rawIndex } from '../../../src/billing/create-billing-patient/index';
import { validateRequestParameters } from '../../../src/billing/create-billing-patient/validateRequestParameters';

const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }));

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
  };
});

const index = rawIndex as unknown as (input: any) => Promise<{ statusCode: number; body: string }>;

const INVALID_INPUT_CODE = INVALID_INPUT_ERROR('x').code;
const input = (body: string | null, secrets: unknown = {}): any => ({
  headers: {},
  body,
  secrets,
});

describe('create-billing-patient', () => {
  describe('validateRequestParameters', () => {
    it('throws MISSING_REQUEST_BODY when the body is absent', () => {
      expect(() => validateRequestParameters(input(null))).toThrow(expect.objectContaining(MISSING_REQUEST_BODY));
    });

    it('throws MISSING_REQUEST_SECRETS when secrets are absent', () => {
      expect(() => validateRequestParameters(input('{}', null))).toThrow(
        expect.objectContaining(MISSING_REQUEST_SECRETS)
      );
    });

    it('throws INVALID_INPUT_ERROR when required names are missing', () => {
      expect(() => validateRequestParameters(input('{}'))).toThrow(
        expect.objectContaining({ code: INVALID_INPUT_CODE })
      );
    });

    it('returns the parsed params plus secrets on a valid body', () => {
      expect(
        validateRequestParameters(
          input(
            JSON.stringify({
              firstName: 'Jane',
              lastName: 'Doe',
            })
          )
        )
      ).toEqual({
        firstName: 'Jane',
        lastName: 'Doe',
        secrets: {},
      });
    });
  });

  describe('index', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('creates a Patient from the supplied fields and returns the assigned id', async () => {
      mockCreate.mockImplementation(async (resource) => ({
        ...resource,
        id: 'pat-1',
      }));

      const res = await index(
        input(
          JSON.stringify({
            firstName: 'Jane',
            lastName: 'Doe',
          })
        )
      );

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ id: 'pat-1' });
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceType: 'Patient',
          active: true,
          name: [
            {
              family: 'Doe',
              given: ['Jane'],
            },
          ],
        })
      );
    });

    it('rejects invalid input before creating anything', async () => {
      await expect(index(input('{}'))).rejects.toMatchObject({ code: INVALID_INPUT_CODE });
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });
});
