import { UpdateNursingOrderInputSchema, UpdateNursingOrderInputValidated } from 'utils';
import { safeValidate, ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): UpdateNursingOrderInputValidated {
  console.group('validateRequestParameters');

  if (!input.body) {
    throw new Error('No request body provided');
  }

  if (!input.headers.Authorization) {
    throw new Error('Authorization header is required');
  }

  const userToken = input.headers.Authorization.replace('Bearer ', '');

  const parsed = JSON.parse(input.body) as unknown;

  const { serviceRequestId, action } = safeValidate(UpdateNursingOrderInputSchema, parsed);

  console.groupEnd();
  console.log('validateRequestParameters success');
  return {
    serviceRequestId,
    action,
    userToken,
    secrets: input.secrets,
  };
}
