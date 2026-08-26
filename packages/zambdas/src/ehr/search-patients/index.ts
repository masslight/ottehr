import Oystehr, { SearchParam } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Patient } from 'fhir/r4b';
import {
  getEmailForIndividual,
  getFormattedPatientFullName,
  getPhoneNumberForIndividual,
} from 'utils/lib/fhir/patient';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { SearchPatientsInputValidated, validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'search-patients';
const DEFAULT_PAGE_SIZE = 15;
const DEFAULT_OFFSET = 0;
let m2mToken = '';

export interface SearchPatientsResult {
  id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: string;
  phone?: string;
  email?: string;
}

export interface SearchPatientsOutput {
  patients: SearchPatientsResult[];
  total: number;
  offset: number;
}

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const parameters = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, parameters.secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, parameters.secrets);
  const output = await performEffect(parameters, oystehr);
  return { statusCode: 200, body: JSON.stringify(output) };
});

export async function performEffect(
  input: SearchPatientsInputValidated,
  oystehr: Oystehr
): Promise<SearchPatientsOutput> {
  const { name, dateOfBirth, phone, email } = input;
  const offset = input.offset ?? DEFAULT_OFFSET;

  const params: SearchParam[] = [
    { name: '_sort', value: '-_lastUpdated' },
    { name: '_total', value: 'accurate' },
    { name: '_count', value: DEFAULT_PAGE_SIZE },
    { name: '_offset', value: offset },
  ];
  if (name) params.push({ name: 'name', value: name });
  if (dateOfBirth) params.push({ name: 'birthdate', value: dateOfBirth });
  if (phone) params.push({ name: 'phone', value: phone });
  if (email) params.push({ name: 'email', value: email });

  const bundle = await oystehr.fhir.search<Patient>({ resourceType: 'Patient', params });
  const patients: SearchPatientsResult[] = bundle.unbundle().map((patient) => ({
    id: patient.id!,
    name: getFormattedPatientFullName(patient),
    firstName: patient.name?.[0]?.given?.[0],
    lastName: patient.name?.[0]?.family,
    dateOfBirth: patient.birthDate,
    gender: patient.gender,
    phone: getPhoneNumberForIndividual(patient),
    email: getEmailForIndividual(patient),
  }));

  return { patients, total: bundle.total ?? 0, offset };
}
