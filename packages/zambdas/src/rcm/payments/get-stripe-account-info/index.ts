import { APIGatewayProxyResult } from 'aws-lambda';
import { wrapHandler, ZambdaInput } from '../../../shared';
import { getStripeClient } from '../../../shared/stripeIntegration';
import { validateRequestParameters } from './validateRequestParameters';

export interface StripeAccountInfo {
  businessName: string | null;
  dbaName: string | null;
  taxId: string | null;
  address: {
    line1: string | null;
    line2: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    country: string | null;
  } | null;
}

export interface StripeTerminalLocationInfo {
  id: string;
  displayName: string | null;
  address: {
    line1: string | null;
    line2: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    country: string | null;
  } | null;
}

export interface GetStripeAccountInfoResponse {
  accountInfo: StripeAccountInfo | null;
  terminalLocations: StripeTerminalLocationInfo[];
  error: string | null;
}

const ZAMBDA_NAME = 'get-stripe-account-info';
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const { stripeAccountId, secrets } = validateRequestParameters(input);

    const stripeClient = getStripeClient(secrets);

    const account = await stripeClient.accounts.retrieve(stripeAccountId);

    const businessName = account.business_profile?.name ?? null;
    const dbaName = account.settings?.dashboard?.display_name ?? null;

    const taxId: string | null = account.company?.tax_id_provided ? 'Provided (on file)' : null;

    const bizAddress = account.business_profile?.support_address ?? account.company?.address ?? null;
    const address = bizAddress
      ? {
          line1: bizAddress.line1 ?? null,
          line2: bizAddress.line2 ?? null,
          city: bizAddress.city ?? null,
          state: bizAddress.state ?? null,
          postalCode: bizAddress.postal_code ?? null,
          country: bizAddress.country ?? null,
        }
      : null;

    const terminalLocationsResponse = await stripeClient.terminal.locations.list(
      { limit: 100 },
      { stripeAccount: stripeAccountId }
    );

    const terminalLocations: StripeTerminalLocationInfo[] = terminalLocationsResponse.data.map((loc) => ({
      id: loc.id,
      displayName: loc.display_name ?? null,
      address: loc.address
        ? {
            line1: loc.address.line1 ?? null,
            line2: loc.address.line2 ?? null,
            city: loc.address.city ?? null,
            state: loc.address.state ?? null,
            postalCode: loc.address.postal_code ?? null,
            country: loc.address.country ?? null,
          }
        : null,
    }));

    const response: GetStripeAccountInfoResponse = {
      accountInfo: { businessName, dbaName, taxId, address },
      terminalLocations,
      error: null,
    };

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('No such account')) {
      const response: GetStripeAccountInfoResponse = {
        accountInfo: null,
        terminalLocations: [],
        error: 'Stripe account not found',
      };
      return {
        statusCode: 200,
        body: JSON.stringify(response),
      };
    }

    if (
      error instanceof Error &&
      'type' in error &&
      (error as Record<string, unknown>).type === 'StripeInvalidRequestError'
    ) {
      const response: GetStripeAccountInfoResponse = {
        accountInfo: null,
        terminalLocations: [],
        error: error.message,
      };
      return {
        statusCode: 200,
        body: JSON.stringify(response),
      };
    }

    throw error;
  }
});
