import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { ChargeItemDefinition } from 'fhir/r4b';
import { SearchChargeItemDefinitionItem, SearchChargeItemDefinitionsResponse } from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import {
  CHARGE_ITEM_DEFINITION_TYPE_SYSTEM,
  createBillingClient,
  getDefaultSettingForChargeItemDefinition,
  getTypeForChargeItemDefinition,
} from '../shared';
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
): Promise<SearchChargeItemDefinitionsResponse> {
  const searchParams = [
    {
      name: '_tag',
      value: `${CHARGE_ITEM_DEFINITION_TYPE_SYSTEM}|${params.type}`,
    },
    { name: '_count', value: String(params.pageSize) },
    { name: '_offset', value: String(params.offset) },
    { name: '_sort', value: 'title' },
    { name: '_total', value: 'accurate' },
  ];

  if (params.name) {
    searchParams.push({ name: 'title', value: params.name });
  }
  const results = await oystehr.fhir.search<ChargeItemDefinition>({
    resourceType: 'ChargeItemDefinition',
    params: searchParams,
  });

  return {
    items: results.unbundle().map((cid) => toListItem(cid)),
    total: results.total ?? 0,
    offset: params.offset,
    pageSize: params.pageSize,
  };
}

function toListItem(cid: ChargeItemDefinition): SearchChargeItemDefinitionItem {
  return {
    id: cid.id!,
    type: getTypeForChargeItemDefinition(cid),
    name: cid.title || 'unknown',
    description: cid.description,
    default: getDefaultSettingForChargeItemDefinition(cid),
    status: cid.status === 'active' ? 'active' : 'retired',
    effectiveDate: cid.date,
  };
}
