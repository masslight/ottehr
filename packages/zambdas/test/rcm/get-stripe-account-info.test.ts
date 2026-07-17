import type { APIGatewayProxyResult } from 'aws-lambda';
import { describe, expect, it, vi } from 'vitest';
import { validateRequestParameters } from '../../src/rcm/payments/get-stripe-account-info/validateRequestParameters';
import type { ZambdaInput } from '../../src/shared/types/common';

// ---------------------------------------------------------------------------
// validateRequestParameters
// ---------------------------------------------------------------------------

function makeInput(body: Record<string, unknown> | null): ZambdaInput {
  return { headers: null, body: body ? JSON.stringify(body) : (null as unknown as string), secrets: null };
}

describe('get-stripe-account-info validateRequestParameters', () => {
  it('returns validated params for valid input', () => {
    const result = validateRequestParameters(makeInput({ stripeAccountId: 'acct_123abc' }));
    expect(result).toMatchObject({ stripeAccountId: 'acct_123abc' });
    expect(result.secrets).toBeNull();
  });

  it('throws when stripeAccountId is missing', () => {
    expect(() => validateRequestParameters(makeInput({}))).toThrow('Validation error: Required at "stripeAccountId"');
  });

  it('throws when stripeAccountId is empty string', () => {
    expect(() => validateRequestParameters(makeInput({ stripeAccountId: '' }))).toThrow(
      'Validation error: String must contain at least 1 character(s) at "stripeAccountId"'
    );
  });

  it('throws when stripeAccountId is not a string', () => {
    expect(() => validateRequestParameters(makeInput({ stripeAccountId: 99 }))).toThrow(
      'Validation error: Expected string, received number at "stripeAccountId"'
    );
  });

  it('parses a stringified body', () => {
    const input: ZambdaInput = {
      headers: null,
      body: JSON.stringify({ stripeAccountId: 'acct_xyz' }),
      secrets: null,
    };
    const result = validateRequestParameters(input);
    expect(result.stripeAccountId).toBe('acct_xyz');
  });
});

// ---------------------------------------------------------------------------
// index handler
// ---------------------------------------------------------------------------

const mockStripeClient = {
  accounts: {
    retrieve: vi.fn(),
  },
  terminal: {
    locations: {
      list: vi.fn(),
    },
  },
};

vi.mock('../../src/shared', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('mock-token'),
    createClinicalOystehrClient: vi.fn(),
    wrapHandler: (_name: string, fn: (...args: unknown[]) => unknown) => fn,
  };
});

vi.mock('../../src/shared/stripeIntegration', () => ({
  getStripeClient: vi.fn(() => mockStripeClient),
}));

const { index: handler } = (await import('../../src/rcm/payments/get-stripe-account-info/index')) as unknown as {
  index: (input: ZambdaInput) => Promise<APIGatewayProxyResult>;
};

describe('get-stripe-account-info handler', () => {
  it('returns account info and terminal locations on success', async () => {
    mockStripeClient.accounts.retrieve.mockResolvedValue({
      business_profile: {
        name: 'Acme Health',
        support_address: {
          line1: '123 Main St',
          line2: 'Suite 100',
          city: 'Springfield',
          state: 'IL',
          postal_code: '62701',
          country: 'US',
        },
      },
      settings: { dashboard: { display_name: 'Acme DBA' } },
      company: { tax_id_provided: true },
    });

    mockStripeClient.terminal.locations.list.mockResolvedValue({
      data: [
        {
          id: 'tml_001',
          display_name: 'Main Office',
          address: {
            line1: '123 Main St',
            line2: null,
            city: 'Springfield',
            state: 'IL',
            postal_code: '62701',
            country: 'US',
          },
        },
      ],
    });

    const result = await handler(makeInput({ stripeAccountId: 'acct_abc' }));

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.error).toBeNull();
    expect(body.accountInfo).toEqual({
      businessName: 'Acme Health',
      dbaName: 'Acme DBA',
      taxId: 'Provided (on file)',
      address: {
        line1: '123 Main St',
        line2: 'Suite 100',
        city: 'Springfield',
        state: 'IL',
        postalCode: '62701',
        country: 'US',
      },
    });
    expect(body.terminalLocations).toHaveLength(1);
    expect(body.terminalLocations[0]).toEqual({
      id: 'tml_001',
      displayName: 'Main Office',
      address: {
        line1: '123 Main St',
        line2: null,
        city: 'Springfield',
        state: 'IL',
        postalCode: '62701',
        country: 'US',
      },
    });
  });

  it('returns null address when no business/company address exists', async () => {
    mockStripeClient.accounts.retrieve.mockResolvedValue({
      business_profile: { name: 'No Address Co' },
      settings: { dashboard: {} },
      company: { tax_id_provided: false },
    });
    mockStripeClient.terminal.locations.list.mockResolvedValue({ data: [] });

    const result = await handler(makeInput({ stripeAccountId: 'acct_abc' }));

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.accountInfo.address).toBeNull();
    expect(body.accountInfo.taxId).toBeNull();
    expect(body.accountInfo.dbaName).toBeNull();
    expect(body.terminalLocations).toEqual([]);
  });

  it('falls back to company address when no support_address exists', async () => {
    mockStripeClient.accounts.retrieve.mockResolvedValue({
      business_profile: { name: 'Co' },
      settings: { dashboard: {} },
      company: {
        tax_id_provided: false,
        address: {
          line1: '456 Oak Ave',
          line2: null,
          city: 'Dallas',
          state: 'TX',
          postal_code: '75201',
          country: 'US',
        },
      },
    });
    mockStripeClient.terminal.locations.list.mockResolvedValue({ data: [] });

    const result = await handler(makeInput({ stripeAccountId: 'acct_abc' }));
    const body = JSON.parse(result.body);
    expect(body.accountInfo.address.city).toBe('Dallas');
  });

  it('returns 200 with error for "No such account" error', async () => {
    mockStripeClient.accounts.retrieve.mockRejectedValue(new Error('No such account: acct_bad'));

    const input = makeInput({ stripeAccountId: 'acct_bad' });
    input.secrets = { ENVIRONMENT: 'testing' };
    const result = await handler(input);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.accountInfo).toBeNull();
    expect(body.terminalLocations).toEqual([]);
    expect(body.error).toBe('Stripe account not found');
  });

  it('returns 200 with error for StripeInvalidRequestError', async () => {
    const stripeError = new Error('Invalid request');
    (stripeError as unknown as Record<string, unknown>).type = 'StripeInvalidRequestError';
    mockStripeClient.accounts.retrieve.mockRejectedValue(stripeError);

    const input = makeInput({ stripeAccountId: 'acct_xyz' });
    input.secrets = { ENVIRONMENT: 'testing' };
    const result = await handler(input);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.accountInfo).toBeNull();
    expect(body.error).toBe('Invalid request');
  });

  it('passes stripeAccount option when listing terminal locations', async () => {
    mockStripeClient.accounts.retrieve.mockResolvedValue({
      business_profile: {},
      settings: { dashboard: {} },
      company: {},
    });
    mockStripeClient.terminal.locations.list.mockResolvedValue({ data: [] });

    await handler(makeInput({ stripeAccountId: 'acct_test123' }));

    expect(mockStripeClient.terminal.locations.list).toHaveBeenCalledWith(
      { limit: 100 },
      { stripeAccount: 'acct_test123' }
    );
  });
});
