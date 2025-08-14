import { ZambdaInput } from '../../shared';
import { CreateUploadAudioRecordingInputValidated } from '.';

export function validateRequestParameters(input: ZambdaInput): CreateUploadAudioRecordingInputValidated {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { visitID } = JSON.parse(input.body);

  if (!visitID) {
    throw new Error('visitID is required');
  }

  return {
    visitID,
    secrets: input.secrets,
  };
}
