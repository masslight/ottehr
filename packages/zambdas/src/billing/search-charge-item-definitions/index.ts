import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { ChargeItemDefinition } from 'fhir/r4b';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { CHARGE_ITEM_DEFINITION_TYPE_SYSTEM, createBillingClient } from '../shared';
import { SearchChargeItemDefinitionsParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
export const index = wrapHandler(
  'search-charge-item-definitions',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    const params = validateRequestParameters(input);
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
    const oystehr = createBillingClient(m2mToken, params.secrets);

    const definitions = await performEffect(oystehr, params);

    return {
      statusCode: 200,
      body: JSON.stringify(definitions),
    };
  }
);

export async function performEffect(
  oystehr: Oystehr,
  params: SearchChargeItemDefinitionsParams
): Promise<ChargeItemDefinition[]> {
  const searchParams = [
    {
      name: '_tag',
      value: `${CHARGE_ITEM_DEFINITION_TYPE_SYSTEM}|${params.type}`,
    },
    { name: '_count', value: String(params.pageSize) },
    { name: '_offset', value: String(params.offset) },
    { name: '_sort', value: 'title' },
  ];

  if (params.name) {
    searchParams.push({ name: 'title', value: params.name });
  }
  const results = await oystehr.fhir.search<ChargeItemDefinition>({
    resourceType: 'ChargeItemDefinition',
    params: searchParams,
  });

  return results.unbundle();
}
