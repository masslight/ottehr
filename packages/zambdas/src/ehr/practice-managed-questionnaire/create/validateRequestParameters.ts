import Oystehr from '@oystehr/sdk';
import { Questionnaire } from 'fhir/r4b';
import { practiceManagedQuestionnaireToFhir } from 'utils/lib/helpers/practice-managed-questionnaires';
import { Secrets } from 'utils/lib/secrets';
import { PracticeManagedQuestionnaireSchema } from 'utils/lib/types/data/practice-managed-questionnaires/practice-managed-questionnaire.schema';
import { PracticeManagedQuestionnaireCreateInput } from 'utils/lib/types/data/practice-managed-questionnaires/practice-managed-questionnaire.types';
import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { ZambdaInput } from '../../../shared/types/common';
import { safeValidate } from '../../../shared/validation';

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

export const validateQuestionnaireUniqueness = async (
  questionnaire: Questionnaire,
  oystehr: Oystehr
): Promise<void> => {
  const url = questionnaire.url;
  const version = questionnaire.version;

  if (!url || !version)
    throw INVALID_INPUT_ERROR(`Url and/or version is missing from Questionnaire. url: ${url} version: ${version}`);

  console.log(`Validating that Questionnaire has been sent with unique canonical attributes ${url}|${version}`);

  const questionnaireSearch = (
    await oystehr.fhir.search<Questionnaire>({
      resourceType: 'Questionnaire',
      params: [
        {
          name: 'url',
          value: url,
        },
        {
          name: 'version',
          value: version,
        },
      ],
    })
  ).unbundle();

  if (questionnaireSearch.length !== 0) {
    throw INVALID_INPUT_ERROR(
      `Questionnaire url|version must be unique. Duplicate questionnaire found: ${questionnaireSearch.map(
        (q) => `Questionnaire/${q.id}`
      )}`
    );
  }
};
