import { ZambdaInput } from '../../shared';
import { CreateResourcesFromAudioRecordingInputValidated } from '.';

export function validateRequestParameters(input: ZambdaInput): CreateResourcesFromAudioRecordingInputValidated {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { visitID, z3URL } = JSON.parse(input.body);

  if (!visitID) {
    throw new Error('visitID is required');
  }

  if (!z3URL) {
    throw new Error('z3URL is required');
  }

  return {
    visitID,
    z3URL,
    secrets: input.secrets,
  };
}
