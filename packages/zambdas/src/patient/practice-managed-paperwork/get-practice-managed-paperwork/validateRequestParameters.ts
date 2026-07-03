import {
  GetAllPracticeManagedPaperworkInput,
  GetAllPracticeManagedPaperworkInputSchema,
  GetPracticeManagedPaperworkForQuestionnaire,
  GetPracticeManagedPaperworkForQuestionnaireInput,
  GetPracticeManagedPaperworkInput,
  INVALID_INPUT_ERROR,
  MISSING_REQUEST_BODY,
  Secrets,
} from 'utils';
import { safeValidate, ZambdaInput } from '../../../shared';

type BaseContext = {
  secrets: Secrets | null;
};

type ValidatedRequest =
  | (BaseContext & GetAllPracticeManagedPaperworkInput & { questionnaireId: undefined })
  | (BaseContext & GetPracticeManagedPaperworkForQuestionnaireInput);

export function validateRequestParameters(input: ZambdaInput): ValidatedRequest {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const secrets = input.secrets;

  let parsed: GetPracticeManagedPaperworkInput;
  try {
    parsed = JSON.parse(input.body);
  } catch {
    throw INVALID_INPUT_ERROR('Unable to parse request body. Invalid JSON.');
  }

  if ('questionnaireId' in parsed) {
    const validated = safeValidate(GetPracticeManagedPaperworkForQuestionnaire, parsed);

    const { appointmentId, questionnaireId } = validated;

    return {
      appointmentId,
      questionnaireId,
      secrets,
    };
  } else {
    const validated = safeValidate(GetAllPracticeManagedPaperworkInputSchema, parsed);

    const { appointmentId } = validated;

    return {
      appointmentId,
      questionnaireId: undefined,
      secrets,
    };
  }
}
