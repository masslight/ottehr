import { Secrets } from 'utils/lib/secrets';
import { PaperworkFlowUpdateInputSchema } from 'utils/lib/types/data/paperwork-flows/paperwork-flows.schema';
import { PaperworkFlowUpdateInput } from 'utils/lib/types/data/paperwork-flows/paperwork-flows.types';
import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { ZambdaInput } from '../../../shared/types/common';
import { safeValidate } from '../../../shared/validation';

type BaseContext = {
  secrets: Secrets | null;
};

export type ValidatedRequest = BaseContext & PaperworkFlowUpdateInput;

export function validateRequestParameters(input: ZambdaInput): ValidatedRequest {
  if (!input.body) throw MISSING_REQUEST_BODY;

  const secrets = input.secrets;
  if (!secrets) throw MISSING_REQUEST_SECRETS;

  let parsed: PaperworkFlowUpdateInput;
  try {
    parsed = JSON.parse(input.body);
  } catch {
    throw INVALID_INPUT_ERROR('Unable to parse request body. Invalid JSON.');
  }

  const validated = safeValidate(PaperworkFlowUpdateInputSchema, parsed);
  const { flow, flowServices, flowId } = validated;

  return {
    flow,
    flowServices,
    flowId,
    secrets,
  };
}
