import { GetOrUploadPatientProfilePhotoInputSchema, GetOrUploadPatientProfilePhotoInputValidated } from 'utils';
import { safeValidate, ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): GetOrUploadPatientProfilePhotoInputValidated {
  console.group('validateRequestParameters');

  if (!input.body) {
    throw new Error('No request body provided');
  }

  const parsed = JSON.parse(input.body) as unknown;

  const validatedParameters = safeValidate(GetOrUploadPatientProfilePhotoInputSchema, parsed);

  console.groupEnd();
  console.log('validateRequestParameters success');

  return {
    ...validatedParameters,
    secrets: input.secrets,
  };
}
