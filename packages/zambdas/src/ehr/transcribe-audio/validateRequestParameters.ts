import { INVALID_INPUT_ERROR, MISSING_REQUIRED_PARAMETERS, TranscribeAudioInput } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): TranscribeAudioInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const parsed = JSON.parse(input.body) as unknown;
  if (!parsed || typeof parsed !== 'object') {
    throw INVALID_INPUT_ERROR('Request body must be a valid JSON object');
  }

  const { z3URL } = parsed as Record<string, unknown>;

  if (typeof z3URL !== 'string' || !z3URL) {
    throw MISSING_REQUIRED_PARAMETERS(['z3URL']);
  }

  return {
    z3URL,
    secrets: input.secrets,
  };
}
