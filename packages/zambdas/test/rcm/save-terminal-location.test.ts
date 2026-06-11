import type { APIGatewayProxyResult } from 'aws-lambda';
import { Device } from 'fhir/r4b';
import {
  STRIPE_TERMINAL_LOCATION_DEVICE_TYPE_CODE,
  STRIPE_TERMINAL_LOCATION_DEVICE_TYPE_SYSTEM,
  STRIPE_TERMINAL_LOCATION_IDENTIFIER_SYSTEM,
} from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { validateRequestParameters } from '../../src/rcm/payments/save-terminal-location/validateRequestParameters';
import type { ZambdaInput } from '../../src/shared/types/common';

// ---------------------------------------------------------------------------
// validateRequestParameters
// ---------------------------------------------------------------------------

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

function makeInput(body: Record<string, unknown> | null): ZambdaInput {
  return { headers: null, body: body ? JSON.stringify(body) : (null as unknown as string), secrets: null };
}

describe('save-terminal-location validateRequestParameters', () => {
  it('returns validated params for valid input with terminalLocationId', () => {
    const result = validateRequestParameters(makeInput({ locationId: VALID_UUID, terminalLocationId: 'tml_abc' }));
    expect(result).toMatchObject({ locationId: VALID_UUID, terminalLocationId: 'tml_abc' });
  });

  it('allows null terminalLocationId (to remove)', () => {
    const result = validateRequestParameters(makeInput({ locationId: VALID_UUID, terminalLocationId: null }));
    expect(result.terminalLocationId).toBeNull();
  });

  it('defaults terminalLocationId to null when not provided', () => {
    const result = validateRequestParameters(makeInput({ locationId: VALID_UUID }));
    expect(result.terminalLocationId).toBeNull();
  });

  it('throws when locationId is missing', () => {
    expect(() => validateRequestParameters(makeInput({}))).toThrow(/locationId/);
  });

  it('throws when locationId is empty string', () => {
    expect(() => validateRequestParameters(makeInput({ locationId: '' }))).toThrow();
  });

  it('throws when locationId is not a string', () => {
    expect(() => validateRequestParameters(makeInput({ locationId: 42 }))).toThrow();
  });

  it('throws when terminalLocationId is not a string or null', () => {
    expect(() => validateRequestParameters(makeInput({ locationId: VALID_UUID, terminalLocationId: 123 }))).toThrow();
  });

  it('throws when terminalLocationId is an empty string', () => {
    expect(() => validateRequestParameters(makeInput({ locationId: VALID_UUID, terminalLocationId: '' }))).toThrow();
  });

  it('accepts whitespace-only terminalLocationId as a valid string', () => {
    const result = validateRequestParameters(makeInput({ locationId: VALID_UUID, terminalLocationId: '  ' }));
    expect(result.terminalLocationId).toBe('  ');
  });
});

// ---------------------------------------------------------------------------
// index handler
// ---------------------------------------------------------------------------

const mockOystehrClient = {
  fhir: {
    search: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
};

vi.mock('utils', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    findTerminalDeviceForLocation: vi.fn(async () => {
      const searchResult = await mockOystehrClient.fhir.search();
      return searchResult;
    }),
  };
});

vi.mock('../../src/shared', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('mock-token'),
    createOystehrClient: vi.fn(() => mockOystehrClient),
    wrapHandler: (_name: string, fn: (...args: unknown[]) => unknown) => fn,
  };
});

const { findTerminalDeviceForLocation } = await import('utils');
const mockedFindDevice = vi.mocked(findTerminalDeviceForLocation);

const { index: handler } = (await import('../../src/rcm/payments/save-terminal-location/index')) as unknown as {
  index: (input: ZambdaInput) => Promise<APIGatewayProxyResult>;
};

function makeDevice(terminalLocationId: string): Device {
  return {
    resourceType: 'Device',
    id: 'device-1',
    meta: { versionId: '1' },
    type: {
      coding: [
        {
          system: STRIPE_TERMINAL_LOCATION_DEVICE_TYPE_SYSTEM,
          code: STRIPE_TERMINAL_LOCATION_DEVICE_TYPE_CODE,
        },
      ],
    },
    location: {
      reference: `Location/${VALID_UUID}`,
    },
    identifier: [
      {
        system: STRIPE_TERMINAL_LOCATION_IDENTIFIER_SYSTEM,
        value: terminalLocationId,
      },
    ],
    status: 'active',
  };
}

describe('save-terminal-location handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a new Device when no existing device and terminalLocationId is provided', async () => {
    mockedFindDevice.mockResolvedValue(undefined);
    mockOystehrClient.fhir.create.mockResolvedValue({});

    const result = await handler(makeInput({ locationId: VALID_UUID, terminalLocationId: 'tml_new' }));

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ success: true });

    expect(mockOystehrClient.fhir.create).toHaveBeenCalledTimes(1);
    const created = mockOystehrClient.fhir.create.mock.calls[0][0] as Device;
    expect(created.resourceType).toBe('Device');
    expect(created.location?.reference).toBe(`Location/${VALID_UUID}`);
    expect(created.identifier).toEqual([{ system: STRIPE_TERMINAL_LOCATION_IDENTIFIER_SYSTEM, value: 'tml_new' }]);
    expect(created.type?.coding?.[0]).toEqual({
      system: STRIPE_TERMINAL_LOCATION_DEVICE_TYPE_SYSTEM,
      code: STRIPE_TERMINAL_LOCATION_DEVICE_TYPE_CODE,
    });
  });

  it('updates existing Device identifier when device exists', async () => {
    const existingDevice = makeDevice('tml_old');
    mockedFindDevice.mockResolvedValue(existingDevice);
    mockOystehrClient.fhir.update.mockResolvedValue({});

    const result = await handler(makeInput({ locationId: VALID_UUID, terminalLocationId: 'tml_replaced' }));

    expect(result.statusCode).toBe(200);
    expect(mockOystehrClient.fhir.update).toHaveBeenCalledTimes(1);

    const updated = mockOystehrClient.fhir.update.mock.calls[0][0] as Device;
    expect(updated.identifier).toHaveLength(1);
    expect(updated.identifier![0]).toEqual({
      system: STRIPE_TERMINAL_LOCATION_IDENTIFIER_SYSTEM,
      value: 'tml_replaced',
    });
  });

  it('deletes existing Device when terminalLocationId is null', async () => {
    const existingDevice = makeDevice('tml_old');
    mockedFindDevice.mockResolvedValue(existingDevice);
    mockOystehrClient.fhir.delete.mockResolvedValue({});

    const result = await handler(makeInput({ locationId: VALID_UUID, terminalLocationId: null }));

    expect(result.statusCode).toBe(200);
    expect(mockOystehrClient.fhir.delete).toHaveBeenCalledWith({
      resourceType: 'Device',
      id: 'device-1',
    });
  });

  it('does nothing when terminalLocationId is null and no device exists', async () => {
    mockedFindDevice.mockResolvedValue(undefined);

    const result = await handler(makeInput({ locationId: VALID_UUID, terminalLocationId: null }));

    expect(result.statusCode).toBe(200);
    expect(mockOystehrClient.fhir.create).not.toHaveBeenCalled();
    expect(mockOystehrClient.fhir.update).not.toHaveBeenCalled();
    expect(mockOystehrClient.fhir.delete).not.toHaveBeenCalled();
  });
});
