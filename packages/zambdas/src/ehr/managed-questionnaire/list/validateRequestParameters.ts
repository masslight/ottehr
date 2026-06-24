import {
  INVALID_INPUT_ERROR,
  isValidUUID,
  ManagedQuestionnaireDetailInput,
  MISSING_REQUEST_BODY,
  Secrets,
} from 'utils';
import { ZambdaInput } from '../../../shared';

type BaseContext = {
  secrets: Secrets | null;
};

type ValidatedRequest =
  | (BaseContext & { type: 'list' })
  | (BaseContext & ManagedQuestionnaireDetailInput & { type: 'detail' });

export function validateRequestParameters(input: ZambdaInput): ValidatedRequest {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const secrets = input.secrets;

  let params: Partial<ManagedQuestionnaireDetailInput>;
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
