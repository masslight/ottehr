import Oystehr, { Bundle, SearchParam } from '@oystehr/sdk';
import { APIGatewayProxyResult, Context } from 'aws-lambda';
import { Patient } from 'fhir/r4b';
import {
  getEmailForIndividual,
  getFormattedPatientFullName,
  getPatientFriendlyId,
  getPhoneNumberForIndividual,
} from 'utils/lib/fhir/patient';
import { getOptionalSecret, SecretsKeys } from 'utils/lib/secrets';
import { PATIENT_SEARCH_TOO_BROAD_ERROR } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { deadlineFromContext, settleByDeadline } from '../../shared/concurrency';
import { sendWarning } from '../../shared/errors';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { SearchPatientsInputValidated, validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'search-patients';
const DEFAULT_PAGE_SIZE = 15;
const DEFAULT_OFFSET = 0;
// A search still running after this long gives up and asks for narrower criteria instead of running into the timeout.
export const SEARCH_TIMEOUT_MS = 25_000;
// A shorter Lambda timeout still wins: stop this long before it so the error goes out in time.
const RESPONSE_RESERVE_MS = 5_000;
let m2mToken = '';

export interface SearchPatientsResult {
  id: string;
  patientFriendlyId?: string;
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

export const index = wrapHandler(
  ZAMBDA_NAME,
  async (input: ZambdaInput, context?: Context): Promise<APIGatewayProxyResult> => {
    const deadline = searchDeadline(context);
    const parameters = validateRequestParameters(input);
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, parameters.secrets);
    const oystehr = createClinicalOystehrClient(m2mToken, parameters.secrets);
    const output = await performEffect(parameters, oystehr, deadline);
    return { statusCode: 200, body: JSON.stringify(output) };
  }
);

export const searchDeadline = (context: Context | undefined): number =>
  Math.min(Date.now() + SEARCH_TIMEOUT_MS, deadlineFromContext(context, RESPONSE_RESERVE_MS) ?? Infinity);

export async function performEffect(
  input: SearchPatientsInputValidated,
  oystehr: Oystehr,
  deadline?: number
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

  const startedAt = Date.now();
  const bundle = await settleByDeadline<Bundle<Patient> | undefined>(
    oystehr.fhir.search<Patient>({ resourceType: 'Patient', params }),
    deadline,
    () => undefined
  );
  if (!bundle) {
    const elapsedMs = Date.now() - startedAt;
    console.warn(`Patient search gave up after ${elapsedMs} ms`);
    const env = getOptionalSecret(SecretsKeys.ENVIRONMENT, input.secrets) ?? '';
    sendWarning('Patient search gave up before the Lambda timeout', env, { elapsedMs });
    throw PATIENT_SEARCH_TOO_BROAD_ERROR;
  }
  const patients: SearchPatientsResult[] = bundle.unbundle().map((patient) => ({
    id: patient.id!,
    patientFriendlyId: getPatientFriendlyId(patient) || undefined,
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
