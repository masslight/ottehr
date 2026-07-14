import { Questionnaire } from 'fhir/r4b';
import { isEqual } from 'lodash';
import {
  INVALID_INPUT_ERROR,
  MISSING_REQUEST_BODY,
  PRACTICE_MANAGED_QUESTIONNAIRE_LATEST_TAG,
  PracticeManagedQuestionnaireCreateInput,
  PracticeManagedQuestionnaireSchema,
  practiceManagedQuestionnaireToFhir,
  Secrets,
} from 'utils';
import { safeValidate, ZambdaInput } from '../../../shared';

type BaseContext = {
  secrets: Secrets | null;
};

type ValidatedRequest = BaseContext & { questionnaire: Questionnaire };

export function validateRequestParameters(input: ZambdaInput): ValidatedRequest {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const secrets = input.secrets;

  let params: PracticeManagedQuestionnaireCreateInput;
  try {
    params = JSON.parse(input.body);
  } catch {
    throw INVALID_INPUT_ERROR('Unable to parse request body. Invalid JSON.');
  }

  const managedQuestionnaire = safeValidate(PracticeManagedQuestionnaireSchema, params.practiceManagedQuestionnaire);
  if (managedQuestionnaire.id) delete managedQuestionnaire.id;

  const fhirQuestionnaire = practiceManagedQuestionnaireToFhir(managedQuestionnaire);

  // confirm that questionnaire is tagged correctly
  const tags = fhirQuestionnaire.meta?.tag;
  const taggedAsLatest = tags?.some((t) => isEqual(t, PRACTICE_MANAGED_QUESTIONNAIRE_LATEST_TAG));
  if (!taggedAsLatest) throw INVALID_INPUT_ERROR(`questionnaire is missing the latest tag`);

  return {
    questionnaire: fhirQuestionnaire,
    secrets,
  };
}
