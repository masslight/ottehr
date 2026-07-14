import Oystehr, { SearchParam } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Questionnaire } from 'fhir/r4b';
import {
  fhirQuestionnaireToPracticeManaged,
  getAllFhirSearchPages,
  MANAGED_QUESTIONNAIRE_ERROR,
  PRACTICE_MANAGED_QUESTIONNAIRE_LATEST_TAG,
  PRACTICE_MANAGED_QUESTIONNAIRE_TAG,
  PracticeManagedQuestionnaireDetailOutput,
  PracticeManagedQuestionnaireListOutput,
} from 'utils';
import { checkOrCreateM2MClientToken } from '../../../shared';
import { createClinicalOystehrClient, wrapHandler, ZambdaInput } from '../../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'practice-managed-questionnaire-list';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`${ZAMBDA_NAME} started`);
  const validatedParameters = validateRequestParameters(input);

  const { type, secrets } = validatedParameters;

  console.log('validateRequestParameters success');

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  let response: PracticeManagedQuestionnaireDetailOutput | PracticeManagedQuestionnaireListOutput | undefined;

  if (type === 'detail') {
    const questionnaireId = validatedParameters.questionnaireId;
    console.log('searching for questionnaire, detail');
    response = await getQuestionnaire(oystehr, questionnaireId);
  } else if (type === 'list') {
    console.log('searching for questionnaires, list');
    response = await getQuestionnaire(oystehr);
  }

  if (!response) throw new Error(`Invalid type parsed: ${type}`);

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

function getQuestionnaire(oystehr: Oystehr): Promise<PracticeManagedQuestionnaireListOutput>;

function getQuestionnaire(oystehr: Oystehr, questionnaireId: string): Promise<PracticeManagedQuestionnaireDetailOutput>;

async function getQuestionnaire(
  oystehr: Oystehr,
  questionnaireId?: string
): Promise<PracticeManagedQuestionnaireDetailOutput | PracticeManagedQuestionnaireListOutput> {
  const searchParams: SearchParam[] = [
    { name: '_sort', value: 'title' },
    { name: '_tag', value: PRACTICE_MANAGED_QUESTIONNAIRE_TAG.code },
    { name: '_tag', value: PRACTICE_MANAGED_QUESTIONNAIRE_LATEST_TAG.code },
  ];

  if (questionnaireId) searchParams.push({ name: '_id', value: questionnaireId });

  const practiceManagedFhirQuestionnaires = await getAllFhirSearchPages<Questionnaire>(
    {
      resourceType: 'Questionnaire',
      params: searchParams,
    },
    oystehr
  );

  console.log(`found questionnaires: ${practiceManagedFhirQuestionnaires.length} total`);

  const practiceManagedQuestionnaires = practiceManagedFhirQuestionnaires.flatMap((questionnaire) => {
    try {
      return [fhirQuestionnaireToPracticeManaged(questionnaire)];
    } catch (error) {
      console.error(
        `Failed to validate fhir questionnaire to managed: ${questionnaire.title} Questionnaire/${questionnaire.id}`,
        error
      );
      return [];
    }
  });

  if (questionnaireId) {
    if (practiceManagedQuestionnaires?.length !== 1) {
      throw MANAGED_QUESTIONNAIRE_ERROR(
        `There was an issue getting the questionnaire with id ${questionnaireId} - ${practiceManagedFhirQuestionnaires?.length} questionnaire(s) were returned`
      );
    }

    const res: PracticeManagedQuestionnaireDetailOutput = {
      practiceManagedQuestionnaires: practiceManagedQuestionnaires[0],
    };

    console.log('returning detail successfully', JSON.stringify(practiceManagedQuestionnaires[0]));
    return res;
  } else {
    const res: PracticeManagedQuestionnaireListOutput = {
      practiceManagedQuestionnaires,
    };

    console.log('returning list successfully');
    return res;
  }
}
