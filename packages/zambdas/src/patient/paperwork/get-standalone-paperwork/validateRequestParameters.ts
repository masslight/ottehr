import { GetStandAlonePaperworkInput } from 'utils/lib/types/data/practice-managed-questionnaires/practice-managed-questionnaire.types';
import { GetStandAlonePaperworkInputSchema } from 'utils/lib/types/data/practice-managed-questionnaires/practice-managed-questionnaire.schema';
import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { Secrets } from 'utils/lib/secrets';
import { ZambdaInput } from '../../../shared/types/common';
import { safeValidate } from '../../../shared/validation';

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
