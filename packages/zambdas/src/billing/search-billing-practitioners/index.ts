import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Practitioner } from 'fhir/r4b';
import { getNPI, getSecret, SecretsKeys } from 'utils';
import { checkOrCreateM2MClientToken, topLevelCatch, wrapHandler, ZambdaInput } from '../../shared';
import { createBillingClient, EXCLUDE_WORKING_COPIES_PARAM, fhirName } from '../shared';
import { SearchBillingPractitionersParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'search-billing-practitioners';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const params = validateRequestParameters(input);
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
    const oystehr = createBillingClient(m2mToken, params.secrets);

    const response = await performEffect(oystehr, params);
    return { statusCode: 200, body: JSON.stringify(response) };
  } catch (error: unknown) {
    return topLevelCatch(ZAMBDA_NAME, error, getSecret(SecretsKeys.ENVIRONMENT, input.secrets));
  }
});

async function performEffect(
  oystehr: Oystehr,
  params: SearchBillingPractitionersParams
): Promise<{ practitioners: unknown[] }> {
  const searchParams: { name: string; value: string }[] = [
    { name: '_count', value: '50' },
    { name: '_sort', value: 'family' },
    EXCLUDE_WORKING_COPIES_PARAM,
  ];
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
