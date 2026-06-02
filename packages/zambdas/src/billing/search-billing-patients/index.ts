import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Patient } from 'fhir/r4b';
import { BillingPatientOption, FRIENDLY_PATIENT_ID_SYSTEM_BASE } from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { createBillingClient, EXCLUDE_WORKING_COPIES_PARAMS, fhirName, formatAddress } from '../shared';
import { SearchBillingPatientsParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'search-billing-patients';

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
  const pageSize = params.pageSize ?? 25;
  const offset = params.offset ?? 0;
  const searchParams: { name: string; value: string }[] = [
    { name: '_count', value: String(pageSize) },
    { name: '_offset', value: String(offset) },
    { name: '_sort', value: 'family' },
  ];
  if (!params.includeWorkingCopies) searchParams.push(...EXCLUDE_WORKING_COPIES_PARAMS);
  if (params.uuid) searchParams.push({ name: '_id', value: params.uuid });
  if (params.name) searchParams.push({ name: 'name', value: params.name });
  if (params.dob) searchParams.push({ name: 'birthdate', value: params.dob });
  if (params.identifier) searchParams.push({ name: 'identifier', value: params.identifier });

  const response = await oystehr.fhir.search<Patient>({ resourceType: 'Patient', params: searchParams });

  const patients = response.unbundle().map((p) => {
    const ids = p.identifier ?? [];
    const friendlyId = ids.find((id) => id.system?.startsWith(FRIENDLY_PATIENT_ID_SYSTEM_BASE))?.value ?? '';

    return {
      id: p.id,
      name: fhirName(p),
      firstName: p.name?.[0]?.given?.join(' ') ?? '',
      lastName: p.name?.[0]?.family ?? '',
      dob: p.birthDate ?? '',
      gender: p.gender ?? '',
      address: formatAddress(p.address?.[0]),
      friendlyId,
    };
  });

  return { patients, total: response.total ?? 0, offset, pageSize };
}
