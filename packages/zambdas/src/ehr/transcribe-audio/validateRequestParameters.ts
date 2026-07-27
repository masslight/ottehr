import { MISSING_REQUIRED_PARAMETERS, TranscribeAudioInput } from 'utils';
import { ZambdaInput } from '../../shared';
import { parseJsonBody } from '../../shared/easy-chart/validation';

export function validateRequestParameters(input: ZambdaInput): TranscribeAudioInput & Pick<ZambdaInput, 'secrets'> {
  const { z3URL } = parseJsonBody(input);

  if (typeof z3URL !== 'string' || !z3URL) {
    throw MISSING_REQUIRED_PARAMETERS(['z3URL']);
  }

  return {
    z3URL,
    secrets: input.secrets,
  };
}
