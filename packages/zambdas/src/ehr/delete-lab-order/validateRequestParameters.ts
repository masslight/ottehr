import { DeleteLabOrderZambdaInput, Secrets } from 'utils';
import { ZambdaInput } from '../../shared';

export interface DeleteLabOrderZambdaInputValidated extends DeleteLabOrderZambdaInput {
  secrets: Secrets;
  userToken: string;
}

export function validateRequestParameters(input: ZambdaInput): DeleteLabOrderZambdaInputValidated {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const userToken = input.headers.Authorization.replace('Bearer ', '');
  const { serviceRequestId } = JSON.parse(input.body);

  if (!serviceRequestId) {
    throw new Error('missing required parameter: serviceRequestId');
  }

  if (!input.secrets) {
    throw new Error('missing secrets');
  }

  return {
    serviceRequestId,
    secrets: input.secrets,
    userToken,
  };
}
