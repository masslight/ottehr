import { randomUUID } from 'node:crypto';
import Oystehr from '@oystehr/sdk';
import type { APIGatewayProxyResult } from 'aws-lambda';
import { APIErrorCode, MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { validateRequestParameters } from '../../src/billing/export-billing-claim-x12/validateRequestParameters';
import { createBillingClient } from '../../src/billing/shared';
import { checkOrCreateM2MClientToken } from '../../src/shared';
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

// checkOrCreateM2MClientToken and createBillingClient are canonical suite-wide mocks
// (vitest.unit-mocks.setup.ts); the real wrapHandler applies, so thrown errors surface as
// the topLevelCatch envelope rather than rejections.
const claimToX12Mock = vi.fn();

const { index: handler } = (await import('../../src/billing/export-billing-claim-x12/index')) as unknown as {
  index: (input: ZambdaInput) => Promise<APIGatewayProxyResult>;
};

describe('export-billing-claim-x12 handler', () => {
  beforeEach(() => {
    claimToX12Mock.mockReset();
    vi.mocked(checkOrCreateM2MClientToken).mockResolvedValue('mock-token');
    vi.mocked(createBillingClient).mockReturnValue({
      rcm: {
        claimToX12: claimToX12Mock,
      },
    } as unknown as ReturnType<typeof createBillingClient>);
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
        ENVIRONMENT: 'local',
      },
    });

    expect(claimToX12Mock).toHaveBeenCalledWith({ claimId: CLAIM_ID });
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ x12: 'ISA*00*~ST*837*' });
  });

  it('surfaces the RCM reason for an incomplete-claim (400) error', async () => {
    const reason =
      '"Claim.insurance[0].coverage.extension[https://extensions.fhir.oystehr.com/rcm-claim-insurance-type]" is undefined';
    claimToX12Mock.mockRejectedValue(
      new Oystehr.OystehrSdkError({
        message: reason,
        code: 4006,
      })
    );

    const result = await handler({
      headers: null,
      body: JSON.stringify({
        claimId: CLAIM_ID,
      }),
      secrets: {
        PROJECT_API,
        ENVIRONMENT: 'local',
      },
    });

    // The real wrapHandler converts the thrown APIError into the topLevelCatch envelope.
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      code: APIErrorCode.RESOURCE_INCOMPLETE_FOR_OPERATION,
      message: reason,
    });
  });

  it('surfaces an unsupported-project (4022) SDK error message in the error envelope', async () => {
    const original = new Oystehr.OystehrSdkError({
      message: 'This endpoint is only for FHIR R4 projects',
      code: 4022,
    });
    claimToX12Mock.mockRejectedValue(original);

    const result = await handler({
      headers: null,
      body: JSON.stringify({
        claimId: CLAIM_ID,
      }),
      secrets: {
        PROJECT_API,
        ENVIRONMENT: 'local',
      },
    });

    // The handler rethrows the SDK error unchanged; 4022 is a valid APIErrorCode, so the
    // wrapper's envelope carries the original message and code through to the client.
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      code: 4022,
      message: 'This endpoint is only for FHIR R4 projects',
    });
  });

  it('masks an unexpected (non-SDK) error as an internal error', async () => {
    claimToX12Mock.mockRejectedValue(new Error('Unexpected error'));

    const result = await handler({
      headers: null,
      body: JSON.stringify({
        claimId: CLAIM_ID,
      }),
      secrets: {
        PROJECT_API,
        ENVIRONMENT: 'local',
      },
    });

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toEqual({ error: 'Internal error' });
  });
});
