import { GetVisitLabelInput, MISSING_REQUEST_BODY, MISSING_REQUIRED_PARAMETERS } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): GetVisitLabelInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { encounterId } = JSON.parse(input.body) as GetVisitLabelInput;

  if (!encounterId) throw MISSING_REQUIRED_PARAMETERS([encounterId]);

  return {
    encounterId,
    secrets: input.secrets,
  };
}
