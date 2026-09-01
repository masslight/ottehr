import { Questionnaire } from 'fhir/r4b';
import { Secrets } from 'utils/lib/secrets';
import { SaveSystemManagedDraftInput } from 'utils/lib/types/data/system-managed-questionnaires/system-managed-questionnaire.types';
import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, MISSING_REQUIRED_PARAMETERS } from 'utils/lib/types/errors';
import { ZambdaInput } from '../../../shared/types/common';

type ValidatedRequest = { secrets: Secrets | null; questionnaire: Questionnaire };

export function validateRequestParameters(input: ZambdaInput): ValidatedRequest {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const secrets = input.secrets;

  let params: SaveSystemManagedDraftInput;
  try {
    params = JSON.parse(input.body);
  } catch {
    throw INVALID_INPUT_ERROR('Unable to parse request body. Invalid JSON.');
  }

  const { questionnaire } = params;
  if (!questionnaire) throw MISSING_REQUIRED_PARAMETERS(['questionnaire']);

  if (questionnaire.resourceType !== 'Questionnaire') {
    throw INVALID_INPUT_ERROR('questionnaire.resourceType must be "Questionnaire".');
  }
  // url is needed to locate the current active version; full validation runs in the handler.
  if (!questionnaire.url) {
    throw INVALID_INPUT_ERROR('questionnaire.url is required.');
  }

  return { secrets, questionnaire };
}
