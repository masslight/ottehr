import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Practitioner } from 'fhir/r4b';
import { BillingPractitionerOption, getNPI } from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { createBillingClient, EXCLUDE_WORKING_COPIES_PARAMS, fhirName } from '../shared';
import { SearchBillingPractitionersParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'search-billing-practitioners';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);

  const response = await performEffect(oystehr, params);
  return { statusCode: 200, body: JSON.stringify(response) };
});

async function performEffect(
  oystehr: Oystehr,
  params: SearchBillingPractitionersParams
): Promise<{ practitioners: BillingPractitionerOption[] }> {
  const searchParams: { name: string; value: string }[] = [
    { name: '_count', value: '50' },
    { name: '_sort', value: 'family' },
  ];
  if (!params.includeWorkingCopies) searchParams.push(...EXCLUDE_WORKING_COPIES_PARAMS);
  if (params.name) searchParams.push({ name: 'name', value: params.name });

  const response = await oystehr.fhir.search<Practitioner>({ resourceType: 'Practitioner', params: searchParams });

  const practitioners = response.unbundle().map((p) => {
    return {
      id: p.id,
      name: fhirName(p),
      firstName: p.name?.[0]?.given?.join(' ') ?? '',
      lastName: p.name?.[0]?.family ?? '',
      npi: getNPI(p) ?? '',
      taxonomy: p.identifier?.find((id) => id.type?.coding?.some((c) => c.code === 'ZZ'))?.value ?? '',
    };
  });

  return { practitioners };
}
