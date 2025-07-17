import Oystehr from '@oystehr/sdk';
import { ServiceRequest } from 'fhir/r4b';
import { CancelRadiologyOrderZambdaInput, isValidUUID, Secrets } from 'utils';
import { validateJsonBody, ZambdaInput } from '../../../shared';
import { ValidatedInput } from '.';

export const validateInput = async (input: ZambdaInput, oystehr: Oystehr): Promise<ValidatedInput> => {
  const validatedBody = await validateBody(input, oystehr);

  const callerAccessToken = input.headers.Authorization.replace('Bearer ', '');
  if (callerAccessToken == null) {
    throw new Error('Caller access token is required');
  }

  return {
    body: validatedBody,
    callerAccessToken,
  };
};

const validateBody = async (input: ZambdaInput, oystehr: Oystehr): Promise<CancelRadiologyOrderZambdaInput> => {
  const { serviceRequestId } = validateJsonBody(input);

  if (!isValidUUID(serviceRequestId)) {
    throw new Error('serviceRequestId is required and must be a uuid');
  }

  let serviceRequest: ServiceRequest;
  try {
    serviceRequest = await oystehr.fhir.get<ServiceRequest>({
      resourceType: 'ServiceRequest',
      id: serviceRequestId,
    });
  } catch (error) {
    if (error instanceof Error) {
      console.log('Error fetching ServiceRequest in validate body: ', error.message);
    }
    throw new Error('Error fetching ServiceRequest in validate body');
  }

  if (serviceRequest.status !== 'active') {
    throw new Error('Only orders with active status can be canceled');
  }

  return {
    serviceRequestId,
  };
};

export const validateSecrets = (secrets: Secrets | null): Secrets => {
  if (!secrets) {
    throw new Error('Secrets are required');
  }

  const {
    ADVAPACS_CLIENT_ID,
    ADVAPACS_CLIENT_SECRET,
    AUTH0_ENDPOINT,
    AUTH0_CLIENT,
    AUTH0_SECRET,
    AUTH0_AUDIENCE,
    FHIR_API,
    PROJECT_API,
  } = secrets;
  if (
    !ADVAPACS_CLIENT_ID ||
    !ADVAPACS_CLIENT_SECRET ||
    !AUTH0_ENDPOINT ||
    !AUTH0_CLIENT ||
    !AUTH0_SECRET ||
    !AUTH0_AUDIENCE ||
    !FHIR_API ||
    !PROJECT_API
  ) {
    throw new Error('Missing required secrets');
  }
  return {
    ADVAPACS_CLIENT_ID,
    ADVAPACS_CLIENT_SECRET,
    AUTH0_ENDPOINT,
    AUTH0_CLIENT,
    AUTH0_SECRET,
    AUTH0_AUDIENCE,
    FHIR_API,
    PROJECT_API,
  };
};
