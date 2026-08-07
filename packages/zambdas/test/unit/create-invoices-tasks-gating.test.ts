import type { APIGatewayProxyResult } from 'aws-lambda';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { index } from '../../src/cron/create-invoices-tasks/index';
import { checkOrCreateM2MClientToken, createClinicalOystehrClient } from '../../src/shared';
import type { ZambdaInput } from '../../src/shared/types/common';

// src/shared is mocked suite-wide in vitest.unit-mocks.setup.ts.

type ZambdaHandler = (input: ZambdaInput) => Promise<APIGatewayProxyResult>;

const handler = index as unknown as ZambdaHandler;

describe('create-invoices-tasks gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkOrCreateM2MClientToken).mockResolvedValue('mock-token');
    vi.mocked(createClinicalOystehrClient).mockImplementation(() => undefined as never);
  });

  it('skips without touching FHIR or Candid when the env is ottehr-only', async () => {
    const result = await handler({
      headers: null,
      body: null,
      secrets: {
        BILLING_INTEGRATION: 'ottehr',
        ENVIRONMENT: 'local',
      },
    });

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).message).toContain('disabled');
    expect(createClinicalOystehrClient).not.toHaveBeenCalled();
  });
});
