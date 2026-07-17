import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Basic } from 'fhir/r4b';
import { BillingService, CODE_SYSTEM_SERVICE_CATEGORY_TAG_SYSTEM, SearchBillingServicesResponse } from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { createBillingClient } from '../shared';
import { SearchBillingServicesParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

export const index = wrapHandler(
  'search-billing-services',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    const params = validateRequestParameters(input);
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
    const oystehr = createBillingClient(m2mToken, params.secrets);

    const response = await performEffect(oystehr, params);
    return { statusCode: 200, body: JSON.stringify(response) };
  }
);

async function performEffect(
  oystehr: Oystehr,
  params: SearchBillingServicesParams
): Promise<SearchBillingServicesResponse> {
  const bundle = await oystehr.fhir.search<Basic>({
    resourceType: 'Basic',
    params: [
      { name: 'code', value: `${CODE_SYSTEM_SERVICE_CATEGORY_TAG_SYSTEM}|${params.name ? params.name : ''}` },
      { name: '_count', value: '200' },
    ],
  });

  const basics = bundle.unbundle();

  const serviceCategories: BillingService[] = basics
    .map((b) => {
      const name = b.code?.text ?? '';
      return {
        name,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return { services: serviceCategories };
}
