import {
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
  SaveServiceFacilityInput,
  SaveServiceFacilityInputSchema,
} from 'utils';
import { safeValidate, ZambdaInput } from '../../shared';

export interface SaveServiceFacilityParams extends SaveServiceFacilityInput {
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): SaveServiceFacilityParams {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const data = safeValidate(SaveServiceFacilityInputSchema, JSON.parse(input.body));
  return {
    ...data,
    secrets: input.secrets,
  };
}
