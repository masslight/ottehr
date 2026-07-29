import type { APIGatewayProxyResult } from 'aws-lambda';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ZambdaInput } from '../../src/shared/types/common';

const mockCreateClinicalOystehrClient = vi.fn();

vi.mock('../../src/shared', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('mock-token'),
    createClinicalOystehrClient: (...args: unknown[]) => mockCreateClinicalOystehrClient(...args),
    wrapHandler: (_name: string, fn: (...args: unknown[]) => unknown) => fn,
  };
});

type ZambdaHandler = (input: ZambdaInput) => Promise<APIGatewayProxyResult>;

let handler!: ZambdaHandler;

describe('create-invoices-tasks gating', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    ({ index: handler } = (await import('../../src/cron/create-invoices-tasks/index')) as unknown as {
      index: ZambdaHandler;
    });
  });

  it('skips without touching FHIR or Candid when the env is ottehr-only', async () => {
    const result = await handler({
      headers: null,
      body: null,
      secrets: {
        BILLING_INTEGRATION: 'ottehr',
      },
    });

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).message).toContain('disabled');
    expect(mockCreateClinicalOystehrClient).not.toHaveBeenCalled();
  });
});
