import {
  MISSING_REQUEST_BODY,
  NOT_AUTHORIZED,
  UpdateNursingOrderInputSchema,
  UpdateNursingOrderInputValidated,
} from 'utils';
import { safeJsonParse, safeValidate, ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): UpdateNursingOrderInputValidated {
  console.group('validateRequestParameters');

  if (!input.headers.Authorization) {
    throw NOT_AUTHORIZED;
  }

  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const userToken = input.headers.Authorization.replace('Bearer ', '');

  const parsed = safeJsonParse(input.body) as unknown;

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
