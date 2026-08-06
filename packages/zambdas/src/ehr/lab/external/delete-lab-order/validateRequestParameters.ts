import { DeleteLabOrderZambdaInput } from 'utils/lib/types/data/labs/labs.types';
import { Secrets } from 'utils/lib/secrets';
import { ZambdaInput } from '../../../../shared/types/common';
import { safeJsonParse } from '../../../../shared/validation';

export interface DeleteLabOrderZambdaInputValidated extends DeleteLabOrderZambdaInput {
  secrets: Secrets;
  userToken: string;
}

export function validateRequestParameters(input: ZambdaInput): DeleteLabOrderZambdaInputValidated {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const userToken = input.headers.Authorization.replace('Bearer ', '');
  const { serviceRequestId } = safeJsonParse(input.body);

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
