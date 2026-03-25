import type { APIGatewayProxyResult } from 'aws-lambda';
import { Extension, Location } from 'fhir/r4b';
import { SCHEDULE_OWNER_STRIPE_TERMINAL_LOCATION_ID_EXTENSION_URL } from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { validateRequestParameters } from '../../src/rcm/payments/save-terminal-location/validateRequestParameters';
import type { ZambdaInput } from '../../src/shared/types/common';

// ---------------------------------------------------------------------------
// validateRequestParameters
// ---------------------------------------------------------------------------

function makeInput(body: Record<string, unknown> | null): ZambdaInput {
  return { headers: null, body: body ? JSON.stringify(body) : (null as unknown as string), secrets: null };
}

describe('save-terminal-location validateRequestParameters', () => {
  it('returns validated params for valid input with terminalLocationId', () => {
    const result = validateRequestParameters(makeInput({ locationId: 'loc-1', terminalLocationId: 'tml_abc' }));
    expect(result).toMatchObject({ locationId: 'loc-1', terminalLocationId: 'tml_abc' });
  });

  it('allows null terminalLocationId (to remove)', () => {
    const result = validateRequestParameters(makeInput({ locationId: 'loc-1', terminalLocationId: null }));
    expect(result.terminalLocationId).toBeNull();
  });

  it('defaults terminalLocationId to null when not provided', () => {
    const result = validateRequestParameters(makeInput({ locationId: 'loc-1' }));
    expect(result.terminalLocationId).toBeNull();
  });

  it('throws when locationId is missing', () => {
    expect(() => validateRequestParameters(makeInput({}))).toThrow(
      'The following required parameters were missing: locationId'
    );
  });

  it('throws when locationId is empty string', () => {
    expect(() => validateRequestParameters(makeInput({ locationId: '' }))).toThrow(
      'The following required parameters were missing: locationId'
    );
  });

  it('throws when locationId is not a string', () => {
    expect(() => validateRequestParameters(makeInput({ locationId: 42 }))).toThrow(
      'The following required parameters were missing: locationId'
    );
  });

  it('throws when terminalLocationId is not a string or null', () => {
    expect(() => validateRequestParameters(makeInput({ locationId: 'loc-1', terminalLocationId: 123 }))).toThrow(
      'terminalLocationId must be a string or null'
    );
  });
});

// ---------------------------------------------------------------------------
// index handler
// ---------------------------------------------------------------------------

const mockOystehrClient = {
  fhir: {
    get: vi.fn(),
    update: vi.fn(),
  },
};

vi.mock('../../src/shared', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('mock-token'),
    createOystehrClient: vi.fn(() => mockOystehrClient),
    wrapHandler: (_name: string, fn: (...args: unknown[]) => unknown) => fn,
  };
});

const { index: handler } = (await import('../../src/rcm/payments/save-terminal-location/index')) as unknown as {
  index: (input: ZambdaInput) => Promise<APIGatewayProxyResult>;
};

function makeLocation(extensions?: Extension[]): Location {
  return {
    resourceType: 'Location',
    id: 'loc-1',
    status: 'active',
    name: 'Test Location',
    extension: extensions,
  } as Location;
}

describe('save-terminal-location handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adds terminal location extension to location without existing extensions', async () => {
    mockOystehrClient.fhir.get.mockResolvedValue(makeLocation());
    mockOystehrClient.fhir.update.mockResolvedValue({});

    const result = await handler(makeInput({ locationId: 'loc-1', terminalLocationId: 'tml_new' }));

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ success: true });

    const updated = mockOystehrClient.fhir.update.mock.calls[0][0] as Location;
    expect(updated.extension).toHaveLength(1);
    expect(updated.extension![0]).toEqual({
      url: SCHEDULE_OWNER_STRIPE_TERMINAL_LOCATION_ID_EXTENSION_URL,
      valueString: 'tml_new',
    });
  });

  it('replaces existing terminal location extension', async () => {
    const existingExt: Extension = {
      url: SCHEDULE_OWNER_STRIPE_TERMINAL_LOCATION_ID_EXTENSION_URL,
      valueString: 'tml_old',
    };
    const otherExt: Extension = { url: 'http://other-ext', valueString: 'keep-me' };
    mockOystehrClient.fhir.get.mockResolvedValue(makeLocation([existingExt, otherExt]));
    mockOystehrClient.fhir.update.mockResolvedValue({});

    await handler(makeInput({ locationId: 'loc-1', terminalLocationId: 'tml_replaced' }));

    const updated = mockOystehrClient.fhir.update.mock.calls[0][0] as Location;
    expect(updated.extension).toHaveLength(2);
    expect(updated.extension!.find((e) => e.url === 'http://other-ext')).toBeDefined();
    expect(
      updated.extension!.find((e) => e.url === SCHEDULE_OWNER_STRIPE_TERMINAL_LOCATION_ID_EXTENSION_URL)?.valueString
    ).toBe('tml_replaced');
  });

  it('removes terminal location extension when terminalLocationId is null', async () => {
    const existingExt: Extension = {
      url: SCHEDULE_OWNER_STRIPE_TERMINAL_LOCATION_ID_EXTENSION_URL,
      valueString: 'tml_old',
    };
    const otherExt: Extension = { url: 'http://other-ext', valueString: 'keep-me' };
    mockOystehrClient.fhir.get.mockResolvedValue(makeLocation([existingExt, otherExt]));
    mockOystehrClient.fhir.update.mockResolvedValue({});

    await handler(makeInput({ locationId: 'loc-1', terminalLocationId: null }));

    const updated = mockOystehrClient.fhir.update.mock.calls[0][0] as Location;
    expect(updated.extension).toHaveLength(1);
    expect(updated.extension![0].url).toBe('http://other-ext');
  });

  it('preserves existing extensions while adding new terminal location', async () => {
    const ext1: Extension = { url: 'http://ext-one', valueString: 'val1' };
    const ext2: Extension = { url: 'http://ext-two', valueString: 'val2' };
    mockOystehrClient.fhir.get.mockResolvedValue(makeLocation([ext1, ext2]));
    mockOystehrClient.fhir.update.mockResolvedValue({});

    await handler(makeInput({ locationId: 'loc-1', terminalLocationId: 'tml_fresh' }));

    const updated = mockOystehrClient.fhir.update.mock.calls[0][0] as Location;
    expect(updated.extension).toHaveLength(3);
  });
});
