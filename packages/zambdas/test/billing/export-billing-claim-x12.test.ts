import type { APIGatewayProxyResult } from 'aws-lambda';
import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { validateRequestParameters } from '../../src/billing/export-billing-claim-x12/validateRequestParameters';
import type { ZambdaInput } from '../../src/shared/types/common';

// todo rewrite tests after migrating to sdk call
const PROJECT_API = 'https://project-api.zapehr.com/v1';

describe('export-billing-claim-x12 validateRequestParameters', () => {
  it('returns validated params for valid input', () => {
    const result = validateRequestParameters({
      headers: null,
      body: JSON.stringify({
        claimId: 'claim-1',
      }),
      secrets: {
        PROJECT_API,
      },
    });
    expect(result).toMatchObject({ claimId: 'claim-1' });
  });

  it('throws when body is missing', () => {
    expect(() =>
      validateRequestParameters({
        headers: null,
        body: null,
        secrets: {
          PROJECT_API,
        },
      })
    ).toThrow(MISSING_REQUEST_BODY.message);
  });

  it('throws when secrets are missing', () => {
    expect(() =>
      validateRequestParameters({
        headers: null,
        body: JSON.stringify({
          claimId: 'claim-1',
        }),
        secrets: null,
      })
    ).toThrow(MISSING_REQUEST_SECRETS.message);
  });

  it('throws when claimId is missing', () => {
    expect(() =>
      validateRequestParameters({
        headers: null,
        body: JSON.stringify({}),
        secrets: {
          PROJECT_API,
        },
      })
    ).toThrow('claimId');
  });
});

vi.mock('../../src/shared', async () => {
  const { safeValidate } = await import('../../src/shared/validation');
  const { validateJsonBody } = await import('../../src/shared/helpers');
  return {
    safeValidate,
    validateJsonBody,
    checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('mock-token'),
    wrapHandler: (_name: string, fn: (...args: unknown[]) => unknown) => fn,
  };
});

const { index: handler } = (await import('../../src/billing/export-billing-claim-x12/index')) as unknown as {
  index: (input: ZambdaInput) => Promise<APIGatewayProxyResult>;
};

describe('export-billing-claim-x12 handler', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POSTs to the x12 endpoint with the bearer token and returns the x12 payload', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        x12: 'ISA*00*~ST*837*',
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await handler({
      headers: null,
      body: JSON.stringify({
        claimId: 'claim-1',
      }),
      secrets: {
        PROJECT_API,
      },
    });

    expect(mockFetch).toHaveBeenCalledWith(
      `${PROJECT_API}/rcm/claim/claim-1/x12`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer mock-token',
        }),
      })
    );
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ x12: 'ISA*00*~ST*837*' });
  });

  it('throws when the endpoint responds with a non-ok status', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      text: async () => 'Unknown claim type',
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(
      handler({
        headers: null,
        body: JSON.stringify({
          claimId: 'claim-1',
        }),
        secrets: {
          PROJECT_API,
        },
      })
    ).rejects.toThrow('claim-1');
  });
});
