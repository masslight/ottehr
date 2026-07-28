import Oystehr, { SearchParam } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Questionnaire } from 'fhir/r4b';
import {
  getAllFhirSearchPages,
  PRACTICE_MANAGED_QUESTIONNAIRE_TAG,
  PracticeManagedQuestionnaireDTO,
  PracticeManagedQuestionnaireListOutput,
} from 'utils';
import { checkOrCreateM2MClientToken } from '../../../shared';
import { createClinicalOystehrClient, wrapHandler, ZambdaInput } from '../../../shared';
import { FhirQuestionnaireSubset, isLatestVersion, questionnaireElements } from '../helpers';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'practice-managed-questionnaire-list';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`${ZAMBDA_NAME} started`);
  const validatedParameters = validateRequestParameters(input);

  const { secrets } = validatedParameters;

  console.log('validateRequestParameters success');

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  console.log('searching for questionnaires');
  const response = await getQuestionnaire(oystehr);

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

async function getQuestionnaire(oystehr: Oystehr): Promise<PracticeManagedQuestionnaireListOutput> {
  const searchParams: SearchParam[] = [
    { name: '_sort', value: 'title' },
    { name: '_tag', value: PRACTICE_MANAGED_QUESTIONNAIRE_TAG.code },
    { name: '_elements', value: questionnaireElements.join(',') },
  ];

  const practiceManagedFhirQuestionnaires = await getAllFhirSearchPages<Questionnaire>(
    {
      resourceType: 'Questionnaire',
      params: searchParams,
    },
    oystehr
  );

  console.log(`found questionnaires: ${practiceManagedFhirQuestionnaires.length} total`);

  const currentVersions = latestVersionPerUrl(practiceManagedFhirQuestionnaires);

  const practiceManagedQuestionnaires = currentVersions.map((questionnaire) => {
    const dto: PracticeManagedQuestionnaireDTO = {
      id: questionnaire.id ?? '',
      title: questionnaire.title ?? '',
      status: questionnaire.status,
    };

    return dto;
  });

  const res: PracticeManagedQuestionnaireListOutput = {
    practiceManagedQuestionnaires,
  };

  console.log('returning list successfully');
  return res;
}

function latestVersionPerUrl(questionnaires: FhirQuestionnaireSubset[]): FhirQuestionnaireSubset[] {
  const latestByUrl = new Map<string, FhirQuestionnaireSubset>();

  for (const questionnaire of questionnaires) {
    const url = questionnaire?.url;
    if (!url) continue;

    const current = latestByUrl.get(url);

    if (!current || isLatestVersion(questionnaire, current)) {
      latestByUrl.set(url, questionnaire);
    }
  }

  return Array.from(latestByUrl.values()).sort((a, b) => (a.title || '').localeCompare(b.title || ''));
}
