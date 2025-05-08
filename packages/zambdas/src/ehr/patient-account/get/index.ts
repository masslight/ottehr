import { checkOrCreateM2MClientToken, createOystehrClient, topLevelCatch, ZambdaInput } from '../../../shared';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  CoverageCheckWithDetails,
  INVALID_RESOURCE_ID_ERROR,
  isValidUUID,
  MISSING_REQUEST_BODY,
  MISSING_REQUIRED_PARAMETERS,
  PatientAccountResponse,
  pullCoverageIdentifyingDetails,
  Secrets,
} from 'utils';
import Oystehr from '@oystehr/sdk';
import { Coverage, CoverageEligibilityResponse, Practitioner } from 'fhir/r4b';
import { getAccountAndCoverageResourcesForPatient } from '../../shared/harvest';
import { parseCoverageEligibilityResponse } from 'utils';

let m2mtoken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    console.groupEnd();
    console.debug('validateRequestParameters success', JSON.stringify(validatedParameters));
    const { secrets } = validatedParameters;
    m2mtoken = await checkOrCreateM2MClientToken(m2mtoken, secrets);
    const oystehr = createOystehrClient(m2mtoken, secrets);
    const resources = await performEffect(validatedParameters, oystehr);

    return {
      statusCode: 200,
      body: JSON.stringify(resources),
    };
  } catch (error: any) {
    console.log('Error: ', JSON.stringify(error.message));
    return topLevelCatch('get-patient-account', error, input.secrets);
  }
};

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
  const mapped = eligibilityCheckResults
    .map((result) => {
      const coverage = (result.contained ?? []).find((resource) => resource.resourceType === 'Coverage') as Coverage;
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
