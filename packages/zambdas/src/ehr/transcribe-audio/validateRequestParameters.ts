import { TranscribeAudioInput } from 'utils/lib/types/data/easy-charting.types';
import { MISSING_REQUIRED_PARAMETERS } from 'utils/lib/types/errors';
import { parseJsonBody } from '../../shared/easy-chart/validation';
import { ZambdaInput } from '../../shared/types/common';

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
