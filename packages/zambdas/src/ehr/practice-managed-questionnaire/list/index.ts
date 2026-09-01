import Oystehr, { SearchParam } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Questionnaire } from 'fhir/r4b';
import { PRACTICE_MANAGED_QUESTIONNAIRE_TAG, SYSTEM_MANAGED_QUESTIONNAIRE_TAG } from 'utils/lib/fhir/constants';
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
  const [practiceManagedDtos, systemManagedDtos] = await Promise.all([
    listPracticeManaged(oystehr),
    listSystemManaged(oystehr),
  ]);

  const res: PracticeManagedQuestionnaireListOutput = {
    practiceManagedQuestionnaires: [...systemManagedDtos, ...practiceManagedDtos],
  };

  console.log('returning list successfully');
  return res;
}

async function listPracticeManaged(oystehr: Oystehr): Promise<PracticeManagedQuestionnaireDTO[]> {
  const searchParams: SearchParam[] = [
    { name: '_sort', value: 'title' },
    { name: '_tag', value: PRACTICE_MANAGED_QUESTIONNAIRE_TAG.code },
    { name: '_elements', value: questionnaireElements.join(',') },
  ];

  const practiceManagedFhirQuestionnaires = await getAllFhirSearchPages<Questionnaire>(
    { resourceType: 'Questionnaire', params: searchParams },
    oystehr
  );

  console.log(`Total practice managed questionnaires found: ${practiceManagedFhirQuestionnaires.length}`);

  const currentVersions = latestVersionPerUrl(practiceManagedFhirQuestionnaires);

  return currentVersions.map((questionnaire) => ({
    id: questionnaire.id ?? '',
    title: questionnaire.title ?? '',
    status: questionnaire.status,
    url: questionnaire.url ?? '',
    isSystemManaged: false,
  }));
}

/**
 * System-managed questionnaires are versioned as separate resources sharing a canonical url. The list
 * row for each url is its highest active version; if a `status: draft` sibling exists it is surfaced via
 * `hasDraft`/`draftId`/`draftVersion` (there is no separate draft row).
 */
async function listSystemManaged(oystehr: Oystehr): Promise<PracticeManagedQuestionnaireDTO[]> {
  const { system, code } = SYSTEM_MANAGED_QUESTIONNAIRE_TAG;
  const searchParams: SearchParam[] = [
    { name: '_tag', value: `${system}|${code}` },
    { name: '_elements', value: questionnaireElements.join(',') },
  ];

  const systemManagedFhirQuestionnaires = await getAllFhirSearchPages<Questionnaire>(
    { resourceType: 'Questionnaire', params: searchParams },
    oystehr
  );

  console.log(`Total system managed questionnaires found: ${systemManagedFhirQuestionnaires.length}`);

  const activeByUrl = new Map<string, FhirQuestionnaireSubset>();
  const draftByUrl = new Map<string, FhirQuestionnaireSubset>();

  for (const questionnaire of systemManagedFhirQuestionnaires) {
    const url = questionnaire.url;
    if (!url) continue;

    const bucket =
      questionnaire.status === 'draft' ? draftByUrl : questionnaire.status === 'active' ? activeByUrl : null;
    if (!bucket) continue; // ignore retired/superseded versions

    const current = bucket.get(url);
    if (!current || isLatestVersion(questionnaire, current)) {
      bucket.set(url, questionnaire);
    }
  }

  // include any url that has an active version (preferred) or, failing that, a draft
  const urls = new Set<string>([...activeByUrl.keys(), ...draftByUrl.keys()]);

  const dtos: PracticeManagedQuestionnaireDTO[] = [];
  for (const url of urls) {
    const active = activeByUrl.get(url);
    const draft = draftByUrl.get(url);
    const row = active ?? draft;
    if (!row) continue;

    dtos.push({
      id: row.id ?? '',
      title: row.title ?? '',
      status: row.status,
      url,
      isSystemManaged: true,
      hasDraft: Boolean(draft),
      ...(draft?.id ? { draftId: draft.id } : {}),
      ...(draft?.version ? { draftVersion: draft.version } : {}),
    });
  }

  return dtos.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
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
