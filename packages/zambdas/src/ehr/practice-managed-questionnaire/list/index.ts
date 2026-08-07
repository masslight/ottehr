import Oystehr, { SearchParam } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Questionnaire } from 'fhir/r4b';
import { PRACTICE_MANAGED_QUESTIONNAIRE_TAG } from 'utils/lib/fhir/constants';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import {
  PracticeManagedQuestionnaireDTO,
  PracticeManagedQuestionnaireListOutput,
} from 'utils/lib/types/data/practice-managed-questionnaires/practice-managed-questionnaire.types';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
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

  console.log('starting search and format');
  const response = await makeListResponse(oystehr);

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

async function makeListResponse(oystehr: Oystehr): Promise<PracticeManagedQuestionnaireListOutput> {
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

  console.log(`Total practice managed questionnaires found: ${practiceManagedFhirQuestionnaires.length}`);

  const currentVersions = latestVersionPerUrl(practiceManagedFhirQuestionnaires);

  console.log(`Total current versions: ${currentVersions.length}`);

  const practiceManagedQuestionnaires = currentVersions.map((questionnaire) => {
    const dto: PracticeManagedQuestionnaireDTO = {
      id: questionnaire.id ?? '',
      title: questionnaire.title ?? '',
      status: questionnaire.status,
      url: questionnaire.url ?? '',
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
