import {
  INVALID_INPUT_ERROR,
  MISSING_REQUEST_BODY,
  SaveManagedPaperworkResponseInput,
  SaveManagedPaperworkResponseInputSchema,
  Secrets,
} from 'utils';
import { safeValidate, ZambdaInput } from '../../../shared';

type BaseContext = {
  secrets: Secrets | null;
};

type ValidatedRequest = BaseContext & SaveManagedPaperworkResponseInput;

export function validateRequestParameters(input: ZambdaInput): ValidatedRequest {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const secrets = input.secrets;

  let parsed: Partial<SaveManagedPaperworkResponseInput>;
  try {
    parsed = JSON.parse(input.body);
  } catch {
    throw INVALID_INPUT_ERROR('Unable to parse request body. Invalid JSON.');
  }

  const validated = safeValidate(SaveManagedPaperworkResponseInputSchema, parsed);

  const { pageAnswers, questionnaireId, complete, appointmentId } = validated;

  return {
    pageAnswers,
    questionnaireId,
    complete,
    appointmentId,
    secrets,
  };
}
