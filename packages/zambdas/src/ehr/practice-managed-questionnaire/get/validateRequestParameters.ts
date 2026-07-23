import {
  INVALID_INPUT_ERROR,
  isValidUUID,
  MISSING_REQUEST_BODY,
  PracticeManagedQuestionnaireGetInput,
  Secrets,
} from 'utils';
import { ZambdaInput } from '../../../shared';

type BaseContext = {
  secrets: Secrets | null;
};

type ValidatedRequest = BaseContext & PracticeManagedQuestionnaireGetInput;

export function validateRequestParameters(input: ZambdaInput): ValidatedRequest {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const secrets = input.secrets;

  let params: Partial<PracticeManagedQuestionnaireGetInput>;
  try {
    params = JSON.parse(input.body);
  } catch {
    throw INVALID_INPUT_ERROR('Unable to parse request body. Invalid JSON.');
  }

  const { questionnaireId } = params;

  if (typeof questionnaireId !== 'string' || !isValidUUID(questionnaireId)) {
    throw INVALID_INPUT_ERROR('questionnaireId must be a valid uuid');
  }

  return {
    questionnaireId,
    secrets,
  };
}
