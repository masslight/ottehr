import { APIGatewayProxyResult } from 'aws-lambda';
import { Patient } from 'fhir/r4b';
import { convertFhirNameToDisplayName, getSecret, SecretsKeys } from 'utils';
import { checkOrCreateM2MClientToken, topLevelCatch, wrapHandler, ZambdaInput } from '../../shared';
import { createBillingClient, EXCLUDE_WORKING_COPIES_PARAM, formatAddress } from '../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'search-billing-patients';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const params = validateRequestParameters(input);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
    const oystehr = createBillingClient(m2mToken, params.secrets);

    const hasSearch = params.name || params.dob || params.identifier || params.uuid;

    const searchParams: { name: string; value: string }[] = [
      { name: '_count', value: '50' },
      { name: '_sort', value: 'family' },
    ];

    // Default view excludes working copies; search includes them
    if (!hasSearch) {
      searchParams.push(EXCLUDE_WORKING_COPIES_PARAM);
    }
    if (params.uuid) searchParams.push({ name: '_id', value: params.uuid });
    if (params.name) searchParams.push({ name: 'name', value: params.name });
    if (params.dob) searchParams.push({ name: 'birthdate', value: params.dob });
    if (params.identifier) searchParams.push({ name: 'identifier', value: params.identifier });

    const response = await oystehr.fhir.search<Patient>({ resourceType: 'Patient', params: searchParams });

    const patients = response.unbundle().map((p) => {
      const name = p.name?.[0];
      const identifiers = p.identifier ?? [];
      const mrn = identifiers.find((id) => id.type?.coding?.some((c) => c.code === 'MR'))?.value ?? '';

      return {
        id: p.id,
        name: name ? convertFhirNameToDisplayName(name) : '',
        firstName: name?.given?.join(' ') ?? '',
        lastName: name?.family ?? '',
        dob: p.birthDate ?? '',
        gender: p.gender ?? '',
        address: formatAddress(p.address?.[0]),
        mrn,
        identifiers: identifiers.map((id) => ({ system: id.system, value: id.value })),
      };
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ patients }),
    };
  } catch (error: unknown) {
    return topLevelCatch(ZAMBDA_NAME, error, getSecret(SecretsKeys.ENVIRONMENT, input.secrets));
  }
});
