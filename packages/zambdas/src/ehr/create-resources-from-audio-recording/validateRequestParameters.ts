import { ZambdaInput } from '../../shared';
import { CreateResourcesFromAudioRecordingInputValidated } from '.';

export function validateRequestParameters(input: ZambdaInput): CreateResourcesFromAudioRecordingInputValidated {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const userToken = input.headers.Authorization.replace('Bearer ', '');

  const { visitID, duration, z3URL } = JSON.parse(input.body);

  if (!z3URL) {
    throw new Error('z3URL is required');
  }

  if (!z3URL.startsWith('https://project-api.zapehr.com')) {
    throw new Error('z3 url must start with https://project-api.zapehr.com');
  }

  if (!visitID) {
    throw new Error('visitID is required');
  }

  return {
    userToken,
    duration,
    z3URL,
    visitID,
    secrets: input.secrets,
  };
}
