import Oystehr, { BatchInputGetRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Coverage, CoverageEligibilityResponse, Practitioner } from 'fhir/r4b';
import {
  CoverageCheckWithDetails,
  getSecret,
  INVALID_RESOURCE_ID_ERROR,
  isValidUUID,
  MISSING_REQUEST_BODY,
  MISSING_REQUIRED_PARAMETERS,
  PatientAccountResponse,
  pullCoverageIdentifyingDetails,
  Secrets,
  SecretsKeys,
} from 'utils';
import { parseCoverageEligibilityResponse } from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { getAccountAndCoverageResourcesForPatient } from '../../shared/harvest';

const ZAMBDA_NAME = 'get-patient-account';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    console.groupEnd();
    console.debug('validateRequestParameters success', JSON.stringify(validatedParameters));
    const { secrets } = validatedParameters;
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);
    const resources = await performEffect(validatedParameters, oystehr);

    return {
      statusCode: 200,
      body: JSON.stringify(resources),
    };
  } catch (error: any) {
    console.log('Error: ', JSON.stringify(error.message));
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('get-patient-account', error, ENVIRONMENT);
  }
});

const performEffect = async (input: Input, oystehr: Oystehr): Promise<PatientAccountResponse> => {
  const { patientId } = input;
  const accountAndCoverages = await getAccountAndCoverageResourcesForPatient(patientId, oystehr);
  const primaryCarePhysician = accountAndCoverages.patient?.contained?.find(
    (resource) => resource.resourceType === 'Practitioner' && resource.active === true
  ) as Practitioner;
  const eligibilityCheckResults = (
    await oystehr.fhir.search<CoverageEligibilityResponse>({
      resourceType: 'CoverageEligibilityResponse',
      params: [
        {
          name: `patient._id`,
          value: patientId,
        },
        {
          name: '_sort',
          value: '-created',
        },
      ],
    })
  ).unbundle();
  const coverageIdsToFetch = eligibilityCheckResults.flatMap((ecr) => {
    if (ecr.insurance?.[0]?.coverage?.reference) {
      const [resourceType, id] = ecr.insurance[0].coverage.reference.split('/');
      if (resourceType === 'Coverage') {
        return id;
      }
    }
    return [];
  });
  const coverageRequests: BatchInputGetRequest[] = coverageIdsToFetch.map((id) => ({
    method: 'GET',
    url: `Coverage/${id}`,
  }));
  const coverages: Coverage[] =
    (await oystehr.fhir.batch<Coverage>({ requests: coverageRequests })).entry?.flatMap((e) => e.resource ?? []) ?? [];

  const mapped = eligibilityCheckResults
    .map((result) => {
      const coverage = [...coverages, ...(result.contained ?? [])].find(
        (resource) =>
          resource.resourceType === 'Coverage' &&
          result.insurance?.[0]?.coverage?.reference?.includes(resource.id ?? '')
      ) as Coverage;
      // console.log('coverageDetails', JSON.stringify(coverage, null, 2));
      if (!coverage) {
        return null;
      }
      const coverageDetails = pullCoverageIdentifyingDetails(coverage);
      if (!coverageDetails) {
        return null;
      }
      return {
        ...parseCoverageEligibilityResponse(result),
        ...coverageDetails,
      } as CoverageCheckWithDetails;
    })
    .filter((result) => result !== null) as CoverageCheckWithDetails[];
  return {
    ...accountAndCoverages,
    primaryCarePhysician,
    coverageChecks: mapped,
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

  console.log('input', JSON.stringify(input, null, 2));
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
