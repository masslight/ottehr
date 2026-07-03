import {
  INVALID_INPUT_ERROR,
  MISSING_REQUEST_BODY,
  SavePracticeManagedPaperworkResponseInput,
  SavePracticeManagedPaperworkResponseInputSchema,
  Secrets,
} from 'utils';
import { safeValidate, ZambdaInput } from '../../../shared';

type BaseContext = {
  secrets: Secrets | null;
};

type ValidatedRequest = BaseContext & SavePracticeManagedPaperworkResponseInput;

export function validateRequestParameters(input: ZambdaInput): ValidatedRequest {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const secrets = input.secrets;

  let parsed: Partial<SavePracticeManagedPaperworkResponseInput>;
  try {
    parsed = JSON.parse(input.body);
  } catch {
    throw INVALID_INPUT_ERROR('Unable to parse request body. Invalid JSON.');
  }

  const validated = safeValidate(SavePracticeManagedPaperworkResponseInputSchema, parsed);

  const { pageAnswers, questionnaireId, complete, appointmentId } = validated;

  return {
    pageAnswers,
    questionnaireId,
    complete,
    appointmentId,
    secrets,
  };
}
