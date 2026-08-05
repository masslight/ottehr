import {
  INVALID_INPUT_ERROR,
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
  PaperworkFlowUpdateInput,
  PaperworkFlowUpdateInputSchema,
  Secrets,
} from 'utils';
import { safeValidate, ZambdaInput } from '../../../shared';

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
