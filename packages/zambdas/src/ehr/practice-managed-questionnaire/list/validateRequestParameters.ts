import {
  INVALID_INPUT_ERROR,
  isValidUUID,
  MISSING_REQUEST_BODY,
  PracticeManagedQuestionnaireDetailInput,
  Secrets,
} from 'utils';
import { ZambdaInput } from '../../../shared';

type BaseContext = {
  secrets: Secrets | null;
};

type ValidatedRequest =
  | (BaseContext & { type: 'list' })
  | (BaseContext & PracticeManagedQuestionnaireDetailInput & { type: 'detail' });

export function validateRequestParameters(input: ZambdaInput): ValidatedRequest {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const secrets = input.secrets;

  let params: Partial<PracticeManagedQuestionnaireDetailInput>;
  try {
    params = JSON.parse(input.body);
  } catch {
    throw INVALID_INPUT_ERROR('Unable to parse request body. Invalid JSON.');
  }

  const { questionnaireId } = params;

  if (questionnaireId) {
    if (typeof questionnaireId !== 'string' || !isValidUUID(questionnaireId)) {
      throw INVALID_INPUT_ERROR('labSetId must be a valid uuid');
    }

    return {
      type: 'detail',
      questionnaireId,
      secrets,
    };
  }

  return {
    type: 'list',
    secrets,
  };
}
