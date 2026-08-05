import type { APIGatewayProxyResult } from 'aws-lambda';
import { Bundle, ChargeItemDefinition } from 'fhir/r4b';
import { CPT_CODE_SYSTEM } from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { validateRequestParameters } from '../../src/rcm/fee-schedules/get-version-history/validateRequestParameters';
import { checkOrCreateM2MClientToken, createClinicalOystehrClient } from '../../src/shared';
import type { ZambdaInput } from '../../src/shared/types/common';

// ---------------------------------------------------------------------------
// validateRequestParameters
// ---------------------------------------------------------------------------

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

function makeInput(body: Record<string, unknown>): ZambdaInput {
  // ENVIRONMENT is required by the real wrapHandler (configSentry) that now wraps the handler.
  return { headers: null, body: JSON.stringify(body), secrets: { ENVIRONMENT: 'local' } };
}

describe('get-version-history validateRequestParameters', () => {
  it('returns validated params', () => {
    const result = validateRequestParameters(makeInput({ resourceId: VALID_UUID }));
    expect(result).toMatchObject({ resourceId: VALID_UUID });
  });

  it('throws when resourceId is missing', () => {
    expect(() => validateRequestParameters(makeInput({}))).toThrow('Validation error: Required at "resourceId"');
  });
});

// ---------------------------------------------------------------------------
// index handler
// ---------------------------------------------------------------------------

const mockOystehrClient = {
  fhir: {
    history: vi.fn(),
  },
};

// checkOrCreateM2MClientToken and createClinicalOystehrClient are canonical suite-wide
// mocks (vitest.unit-mocks.setup.ts); this file's defaults are installed here.
beforeEach(() => {
  vi.mocked(checkOrCreateM2MClientToken).mockResolvedValue('mock-token');
  vi.mocked(createClinicalOystehrClient).mockReturnValue(
    mockOystehrClient as unknown as ReturnType<typeof createClinicalOystehrClient>
  );
});

const { index: handler } = (await import('../../src/rcm/fee-schedules/get-version-history/index')) as unknown as {
  index: (input: ZambdaInput) => Promise<APIGatewayProxyResult>;
};

function makeResource(versionId: string, lastUpdated: string): ChargeItemDefinition {
  return {
    resourceType: 'ChargeItemDefinition',
    id: VALID_UUID,
    status: 'active',
    url: 'http://example.com',
    meta: { versionId, lastUpdated },
    propertyGroup: [
      {
        priceComponent: [
          {
            type: 'base',
            code: { coding: [{ system: CPT_CODE_SYSTEM, code: '99213' }] },
            amount: { value: 100, currency: 'USD' },
          },
        ],
      },
    ],
  };
}

describe('get-version-history handler', () => {
  it('returns entries sorted newest-first', async () => {
    const bundle: Bundle<ChargeItemDefinition> = {
      resourceType: 'Bundle',
      type: 'history',
      entry: [
        { resource: makeResource('1', '2024-01-01T00:00:00Z') },
        { resource: makeResource('3', '2024-03-01T00:00:00Z') },
        { resource: makeResource('2', '2024-02-01T00:00:00Z') },
      ],
    };
    mockOystehrClient.fhir.history.mockResolvedValue(bundle);

    const result = await handler(makeInput({ resourceId: VALID_UUID }));
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.entries).toHaveLength(3);
    expect(body.entries[0].versionId).toBe('3');
    expect(body.entries[1].versionId).toBe('2');
    expect(body.entries[2].versionId).toBe('1');
  });

  it('filters out entries without versionId or lastUpdated', async () => {
    const bundle: Bundle<ChargeItemDefinition> = {
      resourceType: 'Bundle',
      type: 'history',
      entry: [
        { resource: makeResource('1', '2024-01-01T00:00:00Z') },
        {
          resource: {
            resourceType: 'ChargeItemDefinition',
            id: VALID_UUID,
            status: 'active',
            url: 'http://example.com',
            meta: {},
          },
        },
        {
          resource: {
            resourceType: 'ChargeItemDefinition',
            id: VALID_UUID,
            status: 'active',
            url: 'http://example.com',
          },
        },
      ],
    };
    mockOystehrClient.fhir.history.mockResolvedValue(bundle);

    const result = await handler(makeInput({ resourceId: VALID_UUID }));
    const body = JSON.parse(result.body);
    expect(body.entries).toHaveLength(1);
    expect(body.entries[0].versionId).toBe('1');
  });

  it('returns empty entries for empty bundle', async () => {
    mockOystehrClient.fhir.history.mockResolvedValue({
      resourceType: 'Bundle',
      type: 'history',
      entry: [],
    });

    const result = await handler(makeInput({ resourceId: VALID_UUID }));
    const body = JSON.parse(result.body);
    expect(body.entries).toHaveLength(0);
  });

  it('includes full resource in each entry', async () => {
    const resource = makeResource('1', '2024-01-01T00:00:00Z');
    mockOystehrClient.fhir.history.mockResolvedValue({
      resourceType: 'Bundle',
      type: 'history',
      entry: [{ resource }],
    });

    const result = await handler(makeInput({ resourceId: VALID_UUID }));
    const body = JSON.parse(result.body);
    expect(body.entries[0].resource).toMatchObject({
      resourceType: 'ChargeItemDefinition',
      id: VALID_UUID,
    });
  });
});
