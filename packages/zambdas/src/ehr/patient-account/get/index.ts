import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Practitioner } from 'fhir/r4b';
import { getPreferredPharmacyFromPatient } from 'utils/lib/fhir/patient';
import { Secrets } from 'utils/lib/secrets';
import { PatientAccountResponse } from 'utils/lib/types/api/patient-account';
import { INVALID_RESOURCE_ID_ERROR, MISSING_REQUEST_BODY, MISSING_REQUIRED_PARAMETERS } from 'utils/lib/types/errors';
import { isValidUUID } from 'utils/lib/validation/helper';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { getPatientCoverageChecks } from '../../../shared/patient-coverage-checks';
import { wrapHandler } from '../../../shared/sentry';
import { settledValueOrThrow } from '../../../shared/settled';
import { ZambdaInput } from '../../../shared/types/common';
import { getAccountAndCoverageResourcesForPatient } from '../../shared/harvest';

const ZAMBDA_NAME = 'get-patient-account';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.group('validateRequestParameters');
  const validatedParameters = validateRequestParameters(input);
  console.groupEnd();
  const { secrets } = validatedParameters;
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);
  const resources = await performEffect(validatedParameters, oystehr);

  return {
    statusCode: 200,
    body: JSON.stringify(resources),
  };
});

const performEffect = async (input: Input, oystehr: Oystehr): Promise<PatientAccountResponse> => {
  const { patientId } = input;
  console.log('performing effect for patient account get');
  const [accountAndCoveragesResult, coverageChecksResult] = await Promise.allSettled([
    (async () => {
      console.time('getAccountAndCoverageResourcesForPatient');
      const accountAndCoverages = await getAccountAndCoverageResourcesForPatient(patientId, oystehr);
      console.timeEnd('getAccountAndCoverageResourcesForPatient');
      return accountAndCoverages;
    })(),
    getPatientCoverageChecks(patientId, oystehr),
  ]);
  const accountAndCoverages = settledValueOrThrow(accountAndCoveragesResult);
  const primaryCarePhysician = accountAndCoverages.patient?.contained?.find(
    (resource) => resource.resourceType === 'Practitioner' && resource.active === true
  ) as Practitioner;
  const coverageChecks = settledValueOrThrow(coverageChecksResult);
  const { patient } = accountAndCoverages;
  const pharmacy = getPreferredPharmacyFromPatient(patient);
  return {
    ...accountAndCoverages,
    primaryCarePhysician,
    coverageChecks,
    pharmacy,
  };
};

interface Input {
  userToken: string;
  patientId: string;
  secrets: Secrets | null;
}

const validateRequestParameters = (input: ZambdaInput): Input => {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  // not doing anything with the userToken right now, but we may want to write an AuditEvent for viewing these resources
  // at some point and it should always be available, so throwing it in the input interface anticipatorily
  const userToken = input.headers.Authorization.replace('Bearer ', '');

  if (!userToken) {
    throw new Error('user token unexpectedly missing');
  }

  const { secrets } = input;
  const { patientId } = JSON.parse(input.body);

  if (!patientId) {
    throw MISSING_REQUIRED_PARAMETERS(['patientId']);
  }

  if (isValidUUID(patientId) === false) {
    throw INVALID_RESOURCE_ID_ERROR('patientId');
  }

  return {
    secrets,
    userToken,
    patientId,
  };
};
