import { Secrets, topLevelCatch, ZambdaInput } from 'zambda-utils';
import { checkOrCreateM2MClientToken, createOystehrClient } from '../../shared/helpers';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  INVALID_RESOURCE_ID_ERROR,
  isValidUUID,
  MISSING_REQUEST_BODY,
  MISSING_REQUIRED_PARAMETERS,
  PatientAccountResponse,
} from 'utils';
import Oystehr from '@oystehr/sdk';
import { Practitioner } from 'fhir/r4b';
import { getAccountAndCoverageResourcesForPatient } from '../../shared/harvest';

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
  return {
    ...accountAndCoverages,
    primaryCarePhysician,
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
    throw new Error('usere token unexpectedly missing');
  }

  console.log('input', JSON.stringify(input, null, 2));

  const { secrets, patientId } = JSON.parse(input.body);

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
