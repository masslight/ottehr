import {
  GetAllManagedPaperworkInput,
  GetAllManagedPaperworkInputSchema,
  GetManagedPaperworkForQuestionnaire,
  GetManagedPaperworkForQuestionnaireInput,
  GetManagedPaperworkInput,
  INVALID_INPUT_ERROR,
  MISSING_REQUEST_BODY,
  Secrets,
} from 'utils';
import { safeValidate, ZambdaInput } from '../../../shared';

type BaseContext = {
  secrets: Secrets | null;
};

type ValidatedRequest =
  | (BaseContext & GetAllManagedPaperworkInput & { questionnaireId: undefined })
  | (BaseContext & GetManagedPaperworkForQuestionnaireInput);

export function validateRequestParameters(input: ZambdaInput): ValidatedRequest {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const secrets = input.secrets;

  let parsed: GetManagedPaperworkInput;
  try {
    parsed = JSON.parse(input.body);
  } catch {
    throw INVALID_INPUT_ERROR('Unable to parse request body. Invalid JSON.');
  }

  if ('questionnaireId' in parsed) {
    const validated = safeValidate(GetManagedPaperworkForQuestionnaire, parsed);

    const { appointmentId, questionnaireId } = validated;

    return {
      appointmentId,
      questionnaireId,
      secrets,
    };
  } else {
    const validated = safeValidate(GetAllManagedPaperworkInputSchema, parsed);

    const { appointmentId } = validated;

    return {
      appointmentId,
      questionnaireId: undefined,
      secrets,
    };
  }
}
