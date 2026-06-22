import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Location } from 'fhir/r4b';
import { SearchServiceFacilitiesResponse } from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { mapServiceFacility } from '../service-facility.helpers';
import { createBillingClient, EXCLUDE_WORKING_COPIES_PARAMS } from '../shared';
import { SearchServiceFacilitiesParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'search-billing-service-facilities';

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

async function performEffect(
  oystehr: Oystehr,
  params: SearchServiceFacilitiesParams
): Promise<SearchServiceFacilitiesResponse> {
  const pageSize = params.pageSize ?? 50;
  const offset = params.offset ?? 0;

  const searchParams: {
    name: string;
    value: string;
  }[] = [
    {
      name: '_sort',
      value: 'name',
    },
    {
      name: '_count',
      value: String(pageSize),
    },
    {
      name: '_offset',
      value: String(offset),
    },
    {
      name: '_total',
      value: 'accurate',
    },
    ...EXCLUDE_WORKING_COPIES_PARAMS,
  ];

  if (params.facilityId) {
    searchParams.push({
      name: '_id',
      value: params.facilityId,
    });
  } else {
    searchParams.push({
      name: 'status',
      value: 'active',
    });
  }
  if (params.name) {
    searchParams.push({
      name: 'name',
      value: params.name,
    });
  }

  const bundle = await oystehr.fhir.search<Location>({
    resourceType: 'Location',
    params: searchParams,
  });
  const facilities = bundle.unbundle().map(mapServiceFacility);
  return {
    facilities,
    total: bundle.total ?? 0,
    offset,
    pageSize,
  };
}
