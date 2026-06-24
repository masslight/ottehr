import { Questionnaire } from 'fhir/r4b';
import {
  INVALID_INPUT_ERROR,
  ManagedQuestionnaireCreateInput,
  ManagedQuestionnaireSchema,
  managedQuestionnaireToFhir,
  MISSING_REQUEST_BODY,
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

  let params: ManagedQuestionnaireCreateInput;
  try {
    params = JSON.parse(input.body);
  } catch {
    throw INVALID_INPUT_ERROR('Unable to parse request body. Invalid JSON.');
  }

  const managedQuestionnaire = safeValidate(ManagedQuestionnaireSchema, params.managedQuestionnaire);
  if (managedQuestionnaire.id) delete managedQuestionnaire.id;

  const fhirQuestionnaire = managedQuestionnaireToFhir(managedQuestionnaire);

  return {
    questionnaire: fhirQuestionnaire,
    secrets,
  };
}
