import {
  INVALID_INPUT_ERROR,
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
  PaperworkFlowCreateInput,
  PaperworkFlowCreateInputSchema,
  Secrets,
} from 'utils';
import { safeValidate, ZambdaInput } from '../../../shared';

type BaseContext = {
  secrets: Secrets | null;
};

type ValidatedRequest = BaseContext & PaperworkFlowCreateInput;

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
