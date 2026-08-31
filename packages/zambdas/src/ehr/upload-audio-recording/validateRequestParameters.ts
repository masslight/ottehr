import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse } from '../../shared/validation';
import { CreateUploadAudioRecordingInputValidated } from '.';

export function validateRequestParameters(input: ZambdaInput): CreateUploadAudioRecordingInputValidated {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { visitID } = safeJsonParse(input.body);

  if (!visitID) {
    throw new Error('visitID is required');
  }

  return {
    visitID,
    secrets: input.secrets,
  };
}
