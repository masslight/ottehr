import {
  GetOrUploadPatientProfilePhotoInputSchema,
  GetOrUploadPatientProfilePhotoInputValidated,
} from 'utils/lib/types/api/get-patient-profile-photo-url.types';
import { MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../shared/validation';

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
