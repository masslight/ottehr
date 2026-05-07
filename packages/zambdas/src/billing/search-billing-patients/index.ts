import { APIGatewayProxyResult } from 'aws-lambda';
import { Patient } from 'fhir/r4b';
import { convertFhirNameToDisplayName, getSecret, isValidUUID, SecretsKeys } from 'utils';
import { checkOrCreateM2MClientToken, topLevelCatch, wrapHandler, ZambdaInput } from '../../shared';
import { createBillingClient, EXCLUDE_WORKING_COPIES_PARAM, formatAddress } from '../shared';

let m2mToken: string;
const ZAMBDA_NAME = 'search-billing-patients';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, input.secrets);
    const oystehr = createBillingClient(m2mToken, input.secrets);

    let searchName: string | undefined;
    let searchDob: string | undefined;
    let searchIdentifier: string | undefined;
    let searchUuid: string | undefined;
    if (input.body) {
      const body = JSON.parse(input.body);
      searchName = body.name;
      searchDob = body.dob;
      searchIdentifier = body.identifier;
      searchUuid = body.uuid;
    }

    const hasSearch = searchName || searchDob || searchIdentifier || searchUuid;

    const params: { name: string; value: string }[] = [
      { name: '_count', value: '50' },
      { name: '_sort', value: 'family' },
    ];

    if (!hasSearch) {
      params.push(EXCLUDE_WORKING_COPIES_PARAM);
    }
    if (searchUuid) {
      if (!isValidUUID(searchUuid)) {
        return {
          statusCode: 200,
          body: JSON.stringify({ patients: [], message: 'UUID must be a complete valid UUID' }),
        };
      }
      params.push({ name: '_id', value: searchUuid });
    }
    if (searchName) {
      params.push({ name: 'name', value: searchName });
    }
    if (searchDob) {
      params.push({ name: 'birthdate', value: searchDob });
    }
    if (searchIdentifier) {
      params.push({ name: 'identifier', value: searchIdentifier });
    }

    const response = await oystehr.fhir.search<Patient>({
      resourceType: 'Patient',
      params,
    });

    const patients = response.unbundle().map((p) => {
      const identifiers = p.identifier ?? [];
      const friendlyId =
        identifiers.find((id) => id.system === 'https://fhir.zapehr.com/r4/namingsystems/friendly-id')?.value ?? '';
      const externalId =
        identifiers.find((id) => id.system !== 'https://fhir.zapehr.com/r4/namingsystems/friendly-id')?.value ??
        identifiers[0]?.value ??
        '';
      const name = p.name?.[0];
      return {
        id: p.id,
        name: name ? convertFhirNameToDisplayName(name) : '',
        firstName: name?.given?.join(' ') ?? '',
        lastName: name?.family ?? '',
        dob: p.birthDate ?? '',
        gender: p.gender ?? '',
        address: formatAddress(p.address?.[0]),
        externalId,
        friendlyId,
      };
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ patients }),
    };
  } catch (error: any) {
    return topLevelCatch(ZAMBDA_NAME, error, getSecret(SecretsKeys.ENVIRONMENT, input.secrets));
  }
});
