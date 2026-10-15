import { randomBytes } from 'node:crypto';
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

export const ensureUniqueQuestionnaire = async (
  questionnaire: Questionnaire,
  oystehr: Oystehr
): Promise<Questionnaire> => {
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

  if (questionnaireSearch.length === 0) return questionnaire;

  // url|version is taken: append a random suffix to the url so the canonical is unique
  console.log(
    `Duplicate questionnaire found: ${questionnaireSearch.map((q) => `Questionnaire/${q.id}`)}. Appending suffix to url`
  );
  const suffix = randomBytes(3).toString('hex'); // e.g. "a3f9c1"

  return { ...questionnaire, url: `${url}-${suffix}` };
};
