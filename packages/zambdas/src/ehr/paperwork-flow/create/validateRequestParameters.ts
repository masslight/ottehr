import { Secrets } from 'utils/lib/secrets';
import { PaperworkFlowCreateInputSchema } from 'utils/lib/types/data/paperwork-flows/paperwork-flows.schema';
import { PaperworkFlowCreateInput } from 'utils/lib/types/data/paperwork-flows/paperwork-flows.types';
import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { ZambdaInput } from '../../../shared/types/common';
import { safeValidate } from '../../../shared/validation';

type BaseContext = {
  secrets: Secrets | null;
};

export type ValidatedRequest = BaseContext & PaperworkFlowCreateInput;

export function validateRequestParameters(input: ZambdaInput): ValidatedRequest {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const secrets = input.secrets;
  if (!secrets) throw MISSING_REQUEST_SECRETS;

  let parsed: PaperworkFlowCreateInput;
  try {
    parsed = JSON.parse(input.body);
  } catch {
    throw INVALID_INPUT_ERROR('Unable to parse request body. Invalid JSON.');
  }

  const validated = safeValidate(PaperworkFlowCreateInputSchema, parsed);
  const { flow, flowServices } = validated;

  return { flow, flowServices, secrets };
}
