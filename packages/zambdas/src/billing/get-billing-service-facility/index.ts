import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Location } from 'fhir/r4b';
import { FHIR_RESOURCE_NOT_FOUND_CUSTOM, ServiceFacilityItem } from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { mapServiceFacility } from '../service-facility.helpers';
import { createBillingClient } from '../shared';
import { GetServiceFacilityParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'get-billing-service-facility';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.group('validateRequestParameters');
  const params = validateRequestParameters(input);
  const { secrets, ...restOfParams } = params;
  console.groupEnd();
  console.debug('validateRequestParameters success', restOfParams);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createBillingClient(m2mToken, secrets);

  console.group('performEffect');
  const response = await performEffect(oystehr, params);
  console.groupEnd();
  console.debug('performEffect success', response);

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

async function performEffect(oystehr: Oystehr, params: GetServiceFacilityParams): Promise<ServiceFacilityItem> {
  const searchParams: {
    name: string;
    value: string;
  }[] = [
    {
      name: '_sort',
      value: 'name',
    },
    {
      name: '_id',
      value: params.facilityId,
    },
  ];

  const bundle = await oystehr.fhir.search<Location>({
    resourceType: 'Location',
    params: searchParams,
  });
  const facilities = bundle.unbundle().map(mapServiceFacility);
  if (!facilities.length) {
    throw FHIR_RESOURCE_NOT_FOUND_CUSTOM('Could not find service facility');
  }
  return facilities[0];
}
