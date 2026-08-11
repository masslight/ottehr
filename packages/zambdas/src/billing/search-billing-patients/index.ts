import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Patient } from 'fhir/r4b';
import { BillingPatientOption } from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import {
  clinicalFriendlyIdOfCopy,
  clinicalPatientIdOfCopy,
  createBillingClient,
  EXCLUDE_WORKING_COPIES_PARAMS,
  fhirName,
  formatAddress,
  SOURCE_FRIENDLY_PATIENT_ID_SYSTEM,
  SOURCE_IDENTIFIER_SYSTEM,
} from '../shared';
import { SearchBillingPatientsParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'search-billing-patients';
const DEFAULT_PAGE_SIZE = 25;
const DEFAULT_OFFSET = 0;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);

  const response = await performEffect(oystehr, params);
  return { statusCode: 200, body: JSON.stringify(response) };
});

async function performEffect(
  oystehr: Oystehr,
  params: SearchBillingPatientsParams
): Promise<{ patients: BillingPatientOption[]; total: number; offset: number; pageSize: number }> {
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;
  const offset = params.offset ?? DEFAULT_OFFSET;
  const searchParams: { name: string; value: string }[] = [
    { name: '_sort', value: '-_lastUpdated' },
    { name: '_total', value: 'accurate' },
    ...EXCLUDE_WORKING_COPIES_PARAMS,
  ];
  if (params.name) searchParams.push({ name: 'name', value: params.name });
  if (params.dob) searchParams.push({ name: 'birthdate', value: params.dob });
  if (params.uuid) searchParams.push({ name: 'identifier', value: `${SOURCE_IDENTIFIER_SYSTEM}|${params.uuid}` });
  if (params.identifier)
    searchParams.push({ name: 'identifier', value: `${SOURCE_FRIENDLY_PATIENT_ID_SYSTEM}|${params.identifier}` });

  const response = await oystehr.fhir.search<Patient>({
    resourceType: 'Patient',
    params: [...searchParams, { name: '_count', value: String(pageSize) }, { name: '_offset', value: String(offset) }],
  });
  const total = response.total ?? 0;
  const results = response.unbundle();

  const patients = results.map((p) => {
    const clinicalFriendlyId = clinicalFriendlyIdOfCopy(p);
    const clinicalId = clinicalPatientIdOfCopy(p);

    return {
      id: p.id,
      name: fhirName(p),
      firstName: p.name?.[0]?.given?.join(' ') ?? '',
      lastName: p.name?.[0]?.family ?? '',
      dob: p.birthDate ?? '',
      gender: p.gender ?? '',
      address: formatAddress(p.address?.[0]),
      clinicalId: clinicalId ?? '',
      clinicalFriendlyId: clinicalFriendlyId ?? '',
    };
  });

  return { patients, total: total ?? 0, offset, pageSize };
}
