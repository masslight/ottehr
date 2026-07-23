import {
  GetServiceFacilityInput,
  GetServiceFacilityInputSchema,
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
} from 'utils';
import { safeValidate, validateJsonBody, ZambdaInput } from '../../shared';

export interface GetServiceFacilityParams extends GetServiceFacilityInput {
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): GetServiceFacilityParams {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const data = safeValidate(GetServiceFacilityInputSchema, validateJsonBody(input));
  return {
    ...data,
    secrets: input.secrets,
  };
}
