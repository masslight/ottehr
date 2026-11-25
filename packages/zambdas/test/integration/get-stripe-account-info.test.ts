import { randomUUID } from 'crypto';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { GetStripeAccountInfoResponse, index } from '../../src/rcm/payments/get-stripe-account-info/index';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';
import { invokeZambdaHandler } from '../helpers/invoke-zambda-handler';

const stripe = vi.hoisted(() => ({
  accounts: { retrieve: vi.fn() },
  terminal: { locations: { list: vi.fn() } },
}));

vi.mock('../../src/shared/stripeIntegration', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/shared/stripeIntegration')>()),
  getStripeClient: vi.fn(() => stripe),
}));

describe('get-stripe-account-info integration', () => {
  let token: string;
  let cleanup: () => Promise<void>;
  const stripeAccountId = `acct_${randomUUID().replace(/-/g, '').slice(0, 16)}`;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('get-stripe-account-info.test.ts', M2MClientMockType.provider);
    token = setup.testUserM2MToken;
    cleanup = setup.cleanup;
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it("returns the connected account's business profile together with its terminal locations", async () => {
    stripe.accounts.retrieve.mockResolvedValueOnce({
      id: stripeAccountId,
      business_profile: {
        name: 'Integration Urgent Care LLC',
        support_address: {
          line1: '1 Main St',
          line2: 'Suite 2',
          city: 'Albany',
          state: 'NY',
          postal_code: '12207',
          country: 'US',
        },
      },
      settings: { dashboard: { display_name: 'Integration Urgent Care' } },
      company: { tax_id_provided: true },
    });
    stripe.terminal.locations.list.mockResolvedValueOnce({
      data: [
        {
          id: 'tml_front_desk',
          display_name: 'Front desk',
          address: { line1: '1 Main St', city: 'Albany', state: 'NY', postal_code: '12207', country: 'US' },
        },
      ],
    });

    const { statusCode, output } = await invokeZambdaHandler<GetStripeAccountInfoResponse>(
      index,
      { stripeAccountId },
      { token }
    );

    expect(statusCode).toBe(200);
    expect(stripe.accounts.retrieve).toHaveBeenCalledWith(stripeAccountId);
    expect(stripe.terminal.locations.list).toHaveBeenCalledWith({ limit: 100 }, { stripeAccount: stripeAccountId });
    expect(output).toEqual({
      accountInfo: {
        businessName: 'Integration Urgent Care LLC',
        dbaName: 'Integration Urgent Care',
        taxId: 'Provided (on file)',
        address: {
          line1: '1 Main St',
          line2: 'Suite 2',
          city: 'Albany',
          state: 'NY',
          postalCode: '12207',
          country: 'US',
        },
      },
      terminalLocations: [
        {
          id: 'tml_front_desk',
          displayName: 'Front desk',
          address: { line1: '1 Main St', line2: null, city: 'Albany', state: 'NY', postalCode: '12207', country: 'US' },
        },
      ],
      error: null,
    });
  });
});
