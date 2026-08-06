import Oystehr, { SearchParam } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Patient } from 'fhir/r4b';
import { BillingPatientOption } from 'utils/lib/types/data/billing/billing.types';
import { ZambdaInput } from '../../shared/types/common';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { fetchAllPages } from '../../shared/fhir';
import { wrapHandler } from '../../shared/sentry';
import {
  createBillingClient,
  EXCLUDE_WORKING_COPIES_PARAMS,
  fhirName,
  formatAddress,
  SOURCE_FRIENDLY_PATIENT_ID_EXTENSION,
  SOURCE_IDENTIFIER_SYSTEM,
} from '../shared';
import { SearchBillingPatientsParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'search-billing-patients';
const SCAN_PAGE_SIZE = 200;
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

  let results: Patient[] = [];
  let total: number = 0;
  // These two parameters are searches on extension, not currently supported by Oystehr FHIR server
  if (params.uuid || params.identifier) {
    const searchAll = await searchOnClinicalIDs(
      oystehr,
      searchParams,
      params.offset ?? DEFAULT_OFFSET,
      params.pageSize ?? DEFAULT_PAGE_SIZE,
      params.uuid,
      params.identifier
    );
    total = searchAll.total;
    results = searchAll.results;
  } else {
    const response = await oystehr.fhir.search<Patient>({
      resourceType: 'Patient',
      params: [
        ...searchParams,
        { name: '_count', value: String(pageSize) },
        { name: '_offset', value: String(offset) },
      ],
    });
    total = response.total ?? 0;
    results = response.unbundle();
  }

  const patients = results.map((p) => {
    const clinicalFriendlyId = p.extension?.find((e) => e.url === SOURCE_FRIENDLY_PATIENT_ID_EXTENSION)?.valueString;
    const clinicalId = p.extension
      ?.find((e) => e.url === SOURCE_IDENTIFIER_SYSTEM)
      ?.valueReference?.reference?.replace('Patient/', '');

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

export async function searchOnClinicalIDs(
  oystehr: Oystehr,
  baseSearchParams: SearchParam[],
  baseOffset: number,
  basePageSize: number,
  uuid?: string,
  friendlyId?: string
): Promise<{ total: number; results: Patient[] }> {
  let results: Patient[] = [];
  await fetchAllPages(async (offset, count) => {
    const response = oystehr.fhir.search<Patient>({
      resourceType: 'Patient',
      params: [
        ...baseSearchParams,
        {
          name: '_count',
          value: String(count),
        },
        {
          name: '_offset',
          value: String(offset),
        },
      ],
    });
    results.push(...(await response).unbundle());
    return response;
  }, SCAN_PAGE_SIZE);
  // Filter by clinical patient MRN
  if (uuid)
    results = results.filter(
      (p) =>
        p.extension
          ?.find((e) => e.url === SOURCE_IDENTIFIER_SYSTEM)
          ?.valueReference?.reference?.replace('Patient/', '') === uuid
    );
  // Filter by clinical patient friendly ID
  if (friendlyId)
    results = results.filter(
      (p) => p.extension?.find((e) => e.url === SOURCE_FRIENDLY_PATIENT_ID_EXTENSION)?.valueString === friendlyId
    );
  const total = results.length;
  results = results.slice(baseOffset, baseOffset + basePageSize);
  return { total, results };
}
