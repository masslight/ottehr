import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Questionnaire } from 'fhir/r4b';
import {
  fhirQuestionnaireToPracticeManaged,
  MANAGED_QUESTIONNAIRE_ERROR,
  PRACTICE_MANAGED_QUESTIONNAIRE_TAG,
  PracticeManagedQuestionnaire,
  PracticeManagedQuestionnaireGetOutput,
} from 'utils';
import { checkOrCreateM2MClientToken } from '../../../shared';
import { createClinicalOystehrClient, wrapHandler, ZambdaInput } from '../../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'practice-managed-questionnaire-get';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`${ZAMBDA_NAME} started`);
  const validatedParameters = validateRequestParameters(input);

  const { secrets } = validatedParameters;

  console.log('validateRequestParameters success');

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const questionnaireId = validatedParameters.questionnaireId;
  console.log('searching for questionnaire');
  const response = await getQuestionnaire(oystehr, questionnaireId);

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

async function getQuestionnaire(
  oystehr: Oystehr,
  questionnaireId: string
): Promise<PracticeManagedQuestionnaireGetOutput> {
  const questionnaire = await oystehr.fhir.get<Questionnaire>({ resourceType: 'Questionnaire', id: questionnaireId });

  const isPracticeManaged = questionnaire.meta?.tag?.some(
    (t) => t.system === PRACTICE_MANAGED_QUESTIONNAIRE_TAG.system && t.code === PRACTICE_MANAGED_QUESTIONNAIRE_TAG.code
  );

  if (!isPracticeManaged) {
    throw new Error(`Attempting to get questionnaire that is not practice managed Questionnaire/${questionnaireId}`);
  }

  let practiceManagedQuestionnaire: PracticeManagedQuestionnaire | undefined;
  try {
    practiceManagedQuestionnaire = fhirQuestionnaireToPracticeManaged(questionnaire);
  } catch (e) {
    throw MANAGED_QUESTIONNAIRE_ERROR(`Questionnaire has attributes the admin portal cannot process. ${e}`);
  }

  const res: PracticeManagedQuestionnaireGetOutput = {
    practiceManagedQuestionnaire,
  };

  return res;
}
