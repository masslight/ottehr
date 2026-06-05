import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { BillingPayerOption, getPayerId } from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { createBillingClient } from '../shared';
import { SearchBillingPayersParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'search-billing-payers';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);

  const response = await performEffect(oystehr, params);
  return { statusCode: 200, body: JSON.stringify(response) };
});

async function performEffect(
  oystehr: Oystehr,
  params: SearchBillingPayersParams
): Promise<{ payers: BillingPayerOption[] }> {
  // Payers live in the Oystehr RCM service
  const result = await oystehr.rcm.listPayers({ ...(params.name ? { name: params.name } : {}), limit: 50 });
  const payers = result.data.map((payer) => ({
    name: payer.name ?? '',
    payerId: getPayerId(payer) ?? '',
  }));
  return { payers };
}
