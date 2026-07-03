import { Questionnaire } from 'fhir/r4b';
import {
  INVALID_INPUT_ERROR,
  MISSING_REQUEST_BODY,
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

  return {
    questionnaire: fhirQuestionnaire,
    secrets,
  };
}
