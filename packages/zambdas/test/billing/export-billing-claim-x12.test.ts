import type { APIGatewayProxyResult } from 'aws-lambda';
import type { APIError } from 'utils';
import { APIErrorCode, CLAIM_NOT_READY_FOR_X12_EXPORT, MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils';
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

  it('surfaces the RCM message to the caller when generation fails (RCM 400)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      text: async () => JSON.stringify({ message: 'Claim.provider is missing a required identifier', code: '4006' }),
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
    ).rejects.toMatchObject({
      code: APIErrorCode.RESOURCE_INCOMPLETE_FOR_OPERATION,
      statusCode: 400,
      message: 'Claim.provider is missing a required identifier',
    });
  });

  it('falls back to a generic message when RCM returns no message', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      text: async () => '',
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
    ).rejects.toMatchObject({ message: CLAIM_NOT_READY_FOR_X12_EXPORT.message });
  });

  it('surfaces only the RCM message (not the full body) for unexpected server failures', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: async () => JSON.stringify({ message: 'missing critical information', code: '5000' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const error = (await handler({
      headers: null,
      body: JSON.stringify({
        claimId: 'claim-1',
      }),
      secrets: {
        PROJECT_API,
      },
    }).catch((e) => e)) as APIError;

    expect(error.statusCode).toBe(500);
    expect(error.code).toBe(APIErrorCode.MISCONFIGURED_ENVIRONMENT);
    expect(error.message).toContain('missing critical information');
    expect(error.message).not.toContain('5000');
  });

  it('forwards an upstream 401 as a not-authorized error', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: async () => JSON.stringify({ message: 'token rejected' }),
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
    ).rejects.toMatchObject({
      code: APIErrorCode.NOT_AUTHORIZED,
      statusCode: 401,
      message: 'token rejected',
    });
  });

  it('forwards an upstream 404 as a resource-not-found error', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: async () => '',
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
    ).rejects.toMatchObject({
      code: APIErrorCode.FHIR_RESOURCE_NOT_FOUND,
      statusCode: 404,
    });
  });
});
