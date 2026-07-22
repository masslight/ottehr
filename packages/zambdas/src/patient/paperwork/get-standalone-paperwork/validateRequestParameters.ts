import {
  GetStandAlonePaperworkInput,
  GetStandAlonePaperworkInputSchema,
  INVALID_INPUT_ERROR,
  MISSING_REQUEST_BODY,
  Secrets,
} from 'utils';
import { safeValidate, ZambdaInput } from '../../../shared';

type BaseContext = {
  secrets: Secrets | null;
};

type ValidatedRequest = BaseContext & GetStandAlonePaperworkInput;

export function validateRequestParameters(input: ZambdaInput): ValidatedRequest {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const secrets = input.secrets;

  let parsed: GetStandAlonePaperworkInput;
  try {
    parsed = JSON.parse(input.body);
  } catch {
    throw INVALID_INPUT_ERROR('Unable to parse request body. Invalid JSON.');
  }

  const validated = safeValidate(GetStandAlonePaperworkInputSchema, parsed);

  const { questionnaireResponseId } = validated;

  return {
    questionnaireResponseId,
    secrets,
  };
}
