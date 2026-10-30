import { APIGatewayProxyResult } from 'aws-lambda';
import { SearchBillingServicesInputSchema } from 'utils/lib/types/data/billing/billing.schemas';
import { SearchBillingServicesResponse } from 'utils/lib/types/data/billing/billing.types';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { validateWithSchema } from '../../shared/validation';
import { BillingOystehr, createBillingClient, searchBillingServiceCodes } from '../shared';

let m2mToken: string;

export const index = wrapHandler(
  'search-billing-services',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    const params = validateWithSchema(SearchBillingServicesInputSchema, input);
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
    const oystehr = createBillingClient(m2mToken, params.secrets);

    const response = await performEffect(oystehr);
    return { statusCode: 200, body: JSON.stringify(response) };
  }
);

async function performEffect(oystehr: BillingOystehr): Promise<SearchBillingServicesResponse> {
  const codes = await searchBillingServiceCodes(oystehr);
  return { services: codes.map((name) => ({ name })).sort((a, b) => a.name.localeCompare(b.name)) };
}
