import {
  GetOrUploadPatientProfilePhotoInputSchema,
  GetOrUploadPatientProfilePhotoInputValidated,
  MISSING_REQUEST_BODY,
} from 'utils';
import { safeJsonParse, safeValidate, ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): GetOrUploadPatientProfilePhotoInputValidated {
  console.group('validateRequestParameters');

  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const parsed = safeJsonParse(input.body) as unknown;

  const validatedParameters = safeValidate(GetOrUploadPatientProfilePhotoInputSchema, parsed);

  console.groupEnd();
  console.log('validateRequestParameters success');

  return {
    ...validatedParameters,
    secrets: input.secrets,
  };
}
