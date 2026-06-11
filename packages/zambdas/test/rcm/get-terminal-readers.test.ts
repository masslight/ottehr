import type { APIGatewayProxyResult } from 'aws-lambda';
import { describe, expect, it, vi } from 'vitest';
import { validateRequestParameters } from '../../src/rcm/payments/get-terminal-readers/validateRequestParameters';
import type { ZambdaInput } from '../../src/shared/types/common';

// ---------------------------------------------------------------------------
// validateRequestParameters
// ---------------------------------------------------------------------------

function makeInput(body: Record<string, unknown> | null): ZambdaInput {
  return { headers: null, body: body ? JSON.stringify(body) : (null as unknown as string), secrets: null };
}

describe('get-terminal-readers validateRequestParameters', () => {
  it('returns validated params for valid input', () => {
    const result = validateRequestParameters(
      makeInput({ stripeAccountId: 'acct_123abc', terminalLocationId: 'tml_456def' })
    );
    expect(result).toMatchObject({
      stripeAccountId: 'acct_123abc',
      terminalLocationId: 'tml_456def',
    });
    expect(result.secrets).toBeNull();
  });

  it('throws when stripeAccountId is missing', () => {
    expect(() => validateRequestParameters(makeInput({ terminalLocationId: 'tml_456def' }))).toThrow(/stripeAccountId/);
  });

  it('throws when stripeAccountId is empty string', () => {
    expect(() =>
      validateRequestParameters(makeInput({ stripeAccountId: '', terminalLocationId: 'tml_456def' }))
    ).toThrow();
  });

  it('throws when stripeAccountId is not a string', () => {
    expect(() =>
      validateRequestParameters(makeInput({ stripeAccountId: 123, terminalLocationId: 'tml_456def' }))
    ).toThrow();
  });

  it('throws when terminalLocationId is missing', () => {
    expect(() => validateRequestParameters(makeInput({ stripeAccountId: 'acct_123abc' }))).toThrow(
      /terminalLocationId/
    );
  });

  it('throws when terminalLocationId is empty string', () => {
    expect(() =>
      validateRequestParameters(makeInput({ stripeAccountId: 'acct_123abc', terminalLocationId: '' }))
    ).toThrow();
  });

  it('throws when terminalLocationId is not a string', () => {
    expect(() =>
      validateRequestParameters(makeInput({ stripeAccountId: 'acct_123abc', terminalLocationId: 42 }))
    ).toThrow();
  });

  it('parses a stringified body', () => {
    const input: ZambdaInput = {
      headers: null,
      body: JSON.stringify({ stripeAccountId: 'acct_abc', terminalLocationId: 'tml_def' }),
      secrets: null,
    };
    const result = validateRequestParameters(input);
    expect(result.stripeAccountId).toBe('acct_abc');
    expect(result.terminalLocationId).toBe('tml_def');
  });
});

// ---------------------------------------------------------------------------
// index handler
// ---------------------------------------------------------------------------

const mockStripeClient = {
  terminal: {
    readers: {
      list: vi.fn(),
    },
  },
};

vi.mock('../../src/shared', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('mock-token'),
    createOystehrClient: vi.fn(),
    wrapHandler: (_name: string, fn: (...args: unknown[]) => unknown) => fn,
  };
});

vi.mock('../../src/shared/stripeIntegration', () => ({
  getStripeClient: vi.fn(() => mockStripeClient),
}));

const { index: handler } = (await import('../../src/rcm/payments/get-terminal-readers/index')) as unknown as {
  index: (input: ZambdaInput) => Promise<APIGatewayProxyResult>;
};

describe('get-terminal-readers handler', () => {
  it('returns mapped readers on success', async () => {
    mockStripeClient.terminal.readers.list.mockResolvedValue({
      data: [
        {
          id: 'tmr_001',
          label: 'Front Desk',
          device_type: 'bbpos_wisepos_e',
          status: 'online',
          serial_number: 'SN123',
          ip_address: '192.168.1.10',
          device_sw_version: '2.3.0',
        },
        {
          id: 'tmr_002',
          label: null,
          device_type: 'verifone_P400',
          status: 'offline',
          serial_number: null,
          device_sw_version: null,
        },
      ],
    });

    const result = await handler(makeInput({ stripeAccountId: 'acct_abc', terminalLocationId: 'tml_def' }));

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.error).toBeNull();
    expect(body.readers).toHaveLength(2);

    expect(body.readers[0]).toEqual({
      id: 'tmr_001',
      label: 'Front Desk',
      deviceType: 'bbpos_wisepos_e',
      status: 'online',
      serialNumber: 'SN123',
      ipAddress: '192.168.1.10',
      deviceSwVersion: '2.3.0',
    });

    expect(body.readers[1]).toEqual({
      id: 'tmr_002',
      label: null,
      deviceType: 'verifone_P400',
      status: 'offline',
      serialNumber: null,
      ipAddress: null,
      deviceSwVersion: null,
    });
  });

  it('returns empty readers array when no readers exist', async () => {
    mockStripeClient.terminal.readers.list.mockResolvedValue({ data: [] });

    const result = await handler(makeInput({ stripeAccountId: 'acct_abc', terminalLocationId: 'tml_def' }));

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.readers).toEqual([]);
    expect(body.error).toBeNull();
  });

  it('returns 200 with error message for StripeInvalidRequestError', async () => {
    const stripeError = new Error('No such terminal location: tml_invalid');
    (stripeError as unknown as Record<string, unknown>).type = 'StripeInvalidRequestError';
    mockStripeClient.terminal.readers.list.mockRejectedValue(stripeError);

    const input = makeInput({ stripeAccountId: 'acct_abc', terminalLocationId: 'tml_invalid' });
    input.secrets = { ENVIRONMENT: 'testing' };
    const result = await handler(input);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.readers).toEqual([]);
    expect(body.error).toBe('No such terminal location: tml_invalid');
  });

  it('passes stripeAccount option in API call', async () => {
    mockStripeClient.terminal.readers.list.mockResolvedValue({ data: [] });

    await handler(makeInput({ stripeAccountId: 'acct_xyz', terminalLocationId: 'tml_abc' }));

    expect(mockStripeClient.terminal.readers.list).toHaveBeenCalledWith(
      { location: 'tml_abc', limit: 100 },
      { stripeAccount: 'acct_xyz' }
    );
  });
});
