import { randomUUID } from 'node:crypto';
import Oystehr from '@oystehr/sdk';
import type { APIGatewayProxyResult } from 'aws-lambda';
import { APIErrorCode, MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { validateRequestParameters } from '../../src/billing/export-billing-claim-x12/validateRequestParameters';
import type { ZambdaInput } from '../../src/shared/types/common';

const PROJECT_API = 'https://project-api.zapehr.com/v1';
const CLAIM_ID = randomUUID();

describe('export-billing-claim-x12 validateRequestParameters', () => {
  it('returns validated params for valid input', () => {
    const result = validateRequestParameters({
      headers: null,
      body: JSON.stringify({
        claimId: CLAIM_ID,
      }),
      secrets: {
        PROJECT_API,
      },
    });
    expect(result).toMatchObject({ claimId: CLAIM_ID });
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
          claimId: CLAIM_ID,
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

  it('throws when claimId is not a uuid', () => {
    expect(() =>
      validateRequestParameters({
        headers: null,
        body: JSON.stringify({
          claimId: 'not-a-uuid',
        }),
        secrets: {
          PROJECT_API,
        },
      })
    ).toThrow(/uuid/i);
  });
});

const { claimToX12Mock } = vi.hoisted(() => ({ claimToX12Mock: vi.fn() }));

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

vi.mock('../../src/billing/shared', () => ({
  createBillingClient: () => ({
    rcm: {
      claimToX12: claimToX12Mock,
    },
  }),
}));

const { index: handler } = (await import('../../src/billing/export-billing-claim-x12/index')) as unknown as {
  index: (input: ZambdaInput) => Promise<APIGatewayProxyResult>;
};

describe('export-billing-claim-x12 handler', () => {
  beforeEach(() => {
    claimToX12Mock.mockReset();
  });

  it('calls rcm.claimToX12 with the claim id and returns the x12 payload', async () => {
    claimToX12Mock.mockResolvedValue({ x12: 'ISA*00*~ST*837*' });

    const result = await handler({
      headers: null,
      body: JSON.stringify({
        claimId: CLAIM_ID,
      }),
      secrets: {
        PROJECT_API,
      },
    });

    expect(claimToX12Mock).toHaveBeenCalledWith({ claimId: CLAIM_ID });
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ x12: 'ISA*00*~ST*837*' });
  });

  it('surfaces the RCM reason for an incomplete-claim (400) error', async () => {
    const reason = '"Claim.extension[https://extensions.fhir.oystehr.com/rcm-claim-insurance-type]" is undefined';
    claimToX12Mock.mockRejectedValue(
      new Oystehr.OystehrSdkError({
        message: reason,
        code: 4006,
      })
    );

    await expect(
      handler({
        headers: null,
        body: JSON.stringify({
          claimId: CLAIM_ID,
        }),
        secrets: {
          PROJECT_API,
        },
      })
    ).rejects.toMatchObject({
      code: APIErrorCode.RESOURCE_INCOMPLETE_FOR_OPERATION,
      message: reason,
    });
  });

  it('rethrows an unsupported-project (4022) SDK error unchanged', async () => {
    const original = new Oystehr.OystehrSdkError({
      message: 'This endpoint is only for FHIR R4 projects',
      code: 4022,
    });
    claimToX12Mock.mockRejectedValue(original);

    await expect(
      handler({
        headers: null,
        body: JSON.stringify({
          claimId: CLAIM_ID,
        }),
        secrets: {
          PROJECT_API,
        },
      })
    ).rejects.toBe(original);
  });

  it('rethrows an unexpected (non-SDK) error unchanged', async () => {
    const original = new Error('Unexpected error');
    claimToX12Mock.mockRejectedValue(original);

    await expect(
      handler({
        headers: null,
        body: JSON.stringify({
          claimId: CLAIM_ID,
        }),
        secrets: {
          PROJECT_API,
        },
      })
    ).rejects.toBe(original);
  });
});
