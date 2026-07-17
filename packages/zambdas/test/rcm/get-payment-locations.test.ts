import type { APIGatewayProxyResult } from 'aws-lambda';
import { Location } from 'fhir/r4b';
import { describe, expect, it, vi } from 'vitest';
import { validateRequestParameters } from '../../src/rcm/payments/get-payment-locations/validateRequestParameters';
import type { ZambdaInput } from '../../src/shared/types/common';

// ---------------------------------------------------------------------------
// validateRequestParameters
// ---------------------------------------------------------------------------

function makeInput(): ZambdaInput {
  return { headers: null, body: JSON.stringify({}), secrets: null };
}

describe('get-payment-locations validateRequestParameters', () => {
  it('returns secrets from input', () => {
    const result = validateRequestParameters(makeInput());
    expect(result).toMatchObject({ secrets: null });
  });
});

// ---------------------------------------------------------------------------
// index handler
// ---------------------------------------------------------------------------

const mockOystehrClient = {
  fhir: {
    search: vi.fn(),
  },
};

vi.mock('../../src/shared', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('mock-token'),
    createClinicalOystehrClient: vi.fn(() => mockOystehrClient),
    wrapHandler: (_name: string, fn: (...args: unknown[]) => unknown) => fn,
  };
});

const { index: handler } = (await import('../../src/rcm/payments/get-payment-locations/index')) as unknown as {
  index: (input: ZambdaInput) => Promise<APIGatewayProxyResult>;
};

function makeLocation(overrides: Partial<Location> & { id: string; name: string }): Location {
  return {
    resourceType: 'Location',
    status: 'active',
    ...overrides,
  } as Location;
}

describe('get-payment-locations handler', () => {
  it('returns locations with physical addresses', async () => {
    const loc = makeLocation({
      id: 'loc-1',
      name: 'Main Office',
      address: { line: ['123 Main St'], city: 'Springfield', state: 'IL' },
    });
    mockOystehrClient.fhir.search.mockResolvedValue({ unbundle: () => [loc] });

    const result = await handler(makeInput());
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.locations).toHaveLength(1);
    expect(body.locations[0].location.id).toBe('loc-1');
    expect(body.locations[0].supportsVirtualVisits).toBe(false);
  });

  it('filters out locations without addresses that are not virtual', async () => {
    const loc = makeLocation({
      id: 'loc-no-addr',
      name: 'No Address',
      address: {},
    });
    mockOystehrClient.fhir.search.mockResolvedValue({ unbundle: () => [loc] });

    const result = await handler(makeInput());
    const body = JSON.parse(result.body);
    expect(body.locations).toHaveLength(0);
  });

  it('sorts locations alphabetically by name', async () => {
    const locB = makeLocation({
      id: 'loc-b',
      name: 'Bravo Clinic',
      address: { line: ['1 B St'] },
    });
    const locA = makeLocation({
      id: 'loc-a',
      name: 'Alpha Clinic',
      address: { line: ['1 A St'] },
    });
    mockOystehrClient.fhir.search.mockResolvedValue({ unbundle: () => [locB, locA] });

    const result = await handler(makeInput());
    const body = JSON.parse(result.body);
    expect(body.locations[0].location.name).toBe('Alpha Clinic');
    expect(body.locations[1].location.name).toBe('Bravo Clinic');
  });

  it('returns empty array when no locations match', async () => {
    mockOystehrClient.fhir.search.mockResolvedValue({ unbundle: () => [] });

    const result = await handler(makeInput());
    const body = JSON.parse(result.body);
    expect(body.locations).toEqual([]);
  });
});
