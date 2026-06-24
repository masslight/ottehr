import Oystehr, { SearchParam } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Questionnaire } from 'fhir/r4b';
import {
  fhirQuestionnaireToManaged,
  getAllFhirSearchPages,
  MANAGED_QUESTIONNAIRE_ERROR,
  ManagedQuestionnaireDetailOutput,
  ManagedQuestionnaireListOutput,
  PRACTICE_MANAGED_QUESTIONNAIRE_TAG,
} from 'utils';
import { checkOrCreateM2MClientToken } from '../../../shared';
import { createOystehrClient, wrapHandler, ZambdaInput } from '../../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'managed-questionnaire-list';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`${ZAMBDA_NAME} started, input: ${JSON.stringify(input)}`);
  const validatedParameters = validateRequestParameters(input);

  const { type, secrets } = validatedParameters;

  console.log('validateRequestParameters success');

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createOystehrClient(m2mToken, secrets);

  let response: ManagedQuestionnaireDetailOutput | ManagedQuestionnaireListOutput | undefined;

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

function getQuestionnaire(oystehr: Oystehr): Promise<ManagedQuestionnaireListOutput>;

function getQuestionnaire(oystehr: Oystehr, questionnaireId: string): Promise<ManagedQuestionnaireDetailOutput>;

async function getQuestionnaire(
  oystehr: Oystehr,
  questionnaireId?: string
): Promise<ManagedQuestionnaireDetailOutput | ManagedQuestionnaireListOutput> {
  const searchParams: SearchParam[] = [
    { name: '_sort', value: 'title' },
    { name: '_tag', value: PRACTICE_MANAGED_QUESTIONNAIRE_TAG.code },
  ];

  if (questionnaireId) searchParams.push({ name: '_id', value: questionnaireId });

  const managedFhirQuestionnaires = await getAllFhirSearchPages<Questionnaire>(
    {
      resourceType: 'Questionnaire',
      params: searchParams,
    },
    oystehr
  );

  console.log(`found questionnaires: ${managedFhirQuestionnaires.length} total`);

  const managedQuestionnaires = managedFhirQuestionnaires.map(fhirQuestionnaireToManaged);

  if (questionnaireId) {
    if (managedQuestionnaires?.length !== 1) {
      throw MANAGED_QUESTIONNAIRE_ERROR(
        `There was an issue getting the questionnaire with id ${questionnaireId} - ${managedFhirQuestionnaires?.length} questionnaire(s) were returned`
      );
    }

    const res: ManagedQuestionnaireDetailOutput = {
      managedQuestionnaires: managedQuestionnaires[0],
    };

    console.log('returning detail successfully', JSON.stringify(managedQuestionnaires[0]));
    return res;
  } else {
    const res: ManagedQuestionnaireListOutput = {
      managedQuestionnaires,
    };

    console.log('returning list successfully');
    return res;
  }
}
