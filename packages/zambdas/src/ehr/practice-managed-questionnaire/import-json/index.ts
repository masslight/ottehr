import Oystehr, { BatchInputPatchRequest, BatchInputPostRequest, BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Questionnaire } from 'fhir/r4b';
import {
  isJsonImportedQ,
  PRACTICE_MANAGED_QUESTIONNAIRE_BASE_VERSION,
} from 'utils/lib/helpers/practice-managed-questionnaires';
import { RoleType } from 'utils/lib/types/api/user.types';
import { PracticeManagedQuestionnaireImportJsonOutput } from 'utils/lib/types/data/practice-managed-questionnaires/practice-managed-questionnaire.types';
import { INVALID_INPUT_ERROR, MANAGED_QUESTIONNAIRE_ERROR } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken, requireUserWithRole } from '../../../shared/auth';
import { compareVersions } from '../../../shared/fhir';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { handleFormInFlows, patchQuestionnaireVersion, validateQisPracticeManaged } from '../helpers';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'practice-managed-questionnaire-import-json';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`${ZAMBDA_NAME} started`);
  const { questionnaire, questionnaireId, secrets, userToken } = validateRequestParameters(input);

  console.log('validateRequestParameters success');

  await requireUserWithRole(userToken, secrets, [RoleType.CustomerSupport]);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const response = questionnaireId
    ? await importNewVersion(questionnaire, questionnaireId, oystehr)
    : await importNewQuestionnaire(questionnaire, oystehr);

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

const searchQuestionnairesByUrl = async (url: string, oystehr: Oystehr): Promise<Questionnaire[]> => {
  return (
    await oystehr.fhir.search<Questionnaire>({
      resourceType: 'Questionnaire',
      params: [
        { name: 'url', value: url },
        { name: '_elements', value: 'id,url,version,status' },
        { name: '_count', value: '1000' },
      ],
    })
  ).unbundle();
};

async function importNewQuestionnaire(
  questionnaire: Questionnaire,
  oystehr: Oystehr
): Promise<PracticeManagedQuestionnaireImportJsonOutput> {
  const url = questionnaire.url ?? '';

  // a url identifies the questionnaire across all of its versions, reusing one here would silently turn this import
  // into a new version of an existing questionnaire
  console.log(`checking that no questionnaire exists with url ${url}`);
  const existing = await searchQuestionnairesByUrl(url, oystehr);
  if (existing.length > 0) {
    throw INVALID_INPUT_ERROR(
      `A questionnaire with url ${url} already exists (${existing
        .map((q) => `Questionnaire/${q.id}`)
        .join(', ')}). To upload a new version, use "Upload New Version" from that questionnaire's detail page.`
    );
  }

  const version = questionnaire.version ?? PRACTICE_MANAGED_QUESTIONNAIRE_BASE_VERSION;
  const created = await oystehr.fhir.create<Questionnaire>({
    ...questionnaire,
    version,
    status: questionnaire.status ?? 'active',
  });

  console.log(`created Questionnaire/${created.id} ${url}|${version}`);

  return { questionnaireId: created.id ?? '', version };
}

async function importNewVersion(
  questionnaire: Questionnaire,
  questionnaireId: string,
  oystehr: Oystehr
): Promise<PracticeManagedQuestionnaireImportJsonOutput> {
  const previous = await oystehr.fhir.get<Questionnaire>({ resourceType: 'Questionnaire', id: questionnaireId });

  validateQisPracticeManaged(previous, questionnaireId);
  if (!isJsonImportedQ(previous)) {
    throw MANAGED_QUESTIONNAIRE_ERROR(
      `Only questionnaires imported via json can receive a new version via json. Questionnaire/${questionnaireId}`
    );
  }

  const url = previous.url ?? '';
  if (questionnaire.url !== url) {
    throw INVALID_INPUT_ERROR(
      `The url in the uploaded json (${questionnaire.url}) must match the url of the questionnaire being updated (${url})`
    );
  }

  const previousVersion = previous.version ?? PRACTICE_MANAGED_QUESTIONNAIRE_BASE_VERSION;

  // bump against the highest version that exists for the url (not just the one being viewed) so url|version stays unique
  const allVersions = await searchQuestionnairesByUrl(url, oystehr);
  const highestVersion = allVersions.reduce(
    (highest, q) => (q.version && compareVersions(q.version, highest) > 0 ? q.version : highest),
    previousVersion
  );

  // respect a version the user already bumped in the json, otherwise patch
  const nextVersion =
    questionnaire.version && compareVersions(questionnaire.version, highestVersion) > 0
      ? questionnaire.version
      : patchQuestionnaireVersion(highestVersion);
  console.log(`previous version ${previousVersion}, highest version ${highestVersion}, next version ${nextVersion}`);

  const createRequest: BatchInputPostRequest<Questionnaire> = {
    method: 'POST',
    url: '/Questionnaire',
    resource: {
      ...questionnaire,
      version: nextVersion,
      // deleted / restored state is managed in the admin portal, so the new version carries over the current status
      status: previous.status,
    },
  };

  const retireRequests: BatchInputPatchRequest<Questionnaire>[] =
    previous.status === 'retired'
      ? []
      : [
          {
            method: 'PATCH',
            url: `Questionnaire/${questionnaireId}`,
            operations: [{ op: 'replace', path: '/status', value: 'retired' }],
          },
        ];

  console.log('checking if form is contained in any flows');
  const flowRequests: BatchInputRequest<Questionnaire>[] = await handleFormInFlows({
    previousVersion,
    nextVersion,
    url,
    oystehr,
  });
  console.log(
    `Flows containing the target form that will be updated: ${
      flowRequests.length > 0 ? `${flowRequests.map((request) => request.url)}` : 'none'
    }`
  );

  console.log(`Creating version ${nextVersion} of "${url}", "superseding" Questionnaire/${questionnaireId}`);
  const res = (
    await oystehr.fhir.transaction<Questionnaire>({
      requests: [...retireRequests, createRequest, ...flowRequests],
    })
  ).unbundle();

  const created = res.find(
    (resource): resource is Questionnaire =>
      resource.resourceType === 'Questionnaire' && resource.url === url && resource.version === nextVersion
  );

  if (!created?.id) {
    throw new Error(`Failed to find the created questionnaire in the transaction response for ${url}|${nextVersion}`);
  }

  return { questionnaireId: created.id, version: nextVersion };
}
