import Oystehr, { BatchInputPatchRequest, BatchInputPostRequest, BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Questionnaire } from 'fhir/r4b';
import {
  isJsonImportedQ,
  PRACTICE_MANAGED_QUESTIONNAIRE_BASE_VERSION,
} from 'utils/lib/helpers/practice-managed-questionnaires';
import { RoleType } from 'utils/lib/types/api/user.types';
import { PracticeManagedQuestionnaireImportJsonOutput } from 'utils/lib/types/data/practice-managed-questionnaires/practice-managed-questionnaire.types';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken, requireUserWithRole } from '../../../shared/auth';
import { compareVersions } from '../../../shared/fhir';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { handleFormInFlows, patchQuestionnaireVersion } from '../helpers';
import { ValidatedRequest, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'practice-managed-questionnaire-import-json';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`${ZAMBDA_NAME} started`);
  const validatedInput = validateRequestParameters(input);

  console.log('validateRequestParameters success');

  await requireUserWithRole(validatedInput.userToken, validatedInput.secrets, [RoleType.CustomerSupport]);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, validatedInput.secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, validatedInput.secrets);

  const effectInput = await complexValidation(validatedInput, oystehr);
  const response = await performEffect(effectInput, oystehr);

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

interface EffectInput extends Pick<ValidatedRequest, 'questionnaire'> {
  questionnaireUrl: string;
  existingQuestionnaireId: string | undefined;
  existingVersion: string | undefined;
}

async function complexValidation(input: ValidatedRequest, oystehr: Oystehr): Promise<EffectInput> {
  const { questionnaire, questionnaireId } = input;

  if (!questionnaire.url) {
    throw INVALID_INPUT_ERROR(`Questionnaire.url is missing and is a required attribute`);
  }

  let fhirQ: Questionnaire | undefined;

  // deduce the correct fhir questionnaire resource, if one exists
  if (questionnaireId) {
    fhirQ = await oystehr.fhir.get<Questionnaire>({ resourceType: 'Questionnaire', id: questionnaireId });
  } else {
    const existing = await searchActiveQuestionnairesByUrl(questionnaire.url, oystehr);

    if (existing.length > 1) {
      throw new Error(
        `Attempt to import failed: an unexpected number of questionnaires were returned for this url, ${questionnaire.url}`
      );
    } else if (existing.length === 1) {
      fhirQ = existing[0];
    }
  }

  if (fhirQ) {
    // only imported questionnaires can be updated via the import again
    if (!isJsonImportedQ(fhirQ)) {
      throw INVALID_INPUT_ERROR(
        `This questionnaire was created in the Admin Questionnaire portal, please use the Questionnaire Builder to make any desired updates.`
      );
    }

    // validate that the questionnaire.url passed matches
    if (fhirQ.url !== questionnaire.url) {
      throw INVALID_INPUT_ERROR(
        `The questionnaire.url uploaded does not match the existing url. Url from uploaded json: ${questionnaire.url} Existing Url: ${fhirQ.url}`
      );
    }
  }

  return {
    questionnaire,
    questionnaireUrl: questionnaire.url,
    existingQuestionnaireId: fhirQ?.id,
    existingVersion: fhirQ?.version,
  };
}

const searchActiveQuestionnairesByUrl = async (url: string, oystehr: Oystehr): Promise<Questionnaire[]> => {
  return (
    await oystehr.fhir.search<Questionnaire>({
      resourceType: 'Questionnaire',
      params: [
        { name: 'status', value: 'active' },
        { name: 'url', value: url },
        { name: '_elements', value: 'id,url,version' },
        { name: '_count', value: '1000' },
      ],
    })
  ).unbundle();
};

async function performEffect(
  input: EffectInput,
  oystehr: Oystehr
): Promise<PracticeManagedQuestionnaireImportJsonOutput> {
  const { existingQuestionnaireId } = input;

  if (existingQuestionnaireId) {
    return await importNewVersion({ ...input, existingQuestionnaireId }, oystehr);
  } else {
    return await importNewQuestionnaire(input, oystehr);
  }
}

async function importNewQuestionnaire(
  input: EffectInput,
  oystehr: Oystehr
): Promise<PracticeManagedQuestionnaireImportJsonOutput> {
  const { questionnaire, questionnaireUrl } = input;

  const version = questionnaire.version ?? PRACTICE_MANAGED_QUESTIONNAIRE_BASE_VERSION;
  const created = await oystehr.fhir.create<Questionnaire>({
    ...questionnaire,
    version,
    status: 'active',
  });

  console.log(`created Questionnaire/${created.id} ${questionnaireUrl}|${version}`);

  return { questionnaireId: created.id ?? '', version };
}

async function importNewVersion(
  input: Omit<EffectInput, 'existingQuestionnaireId'> & { existingQuestionnaireId: string },
  oystehr: Oystehr
): Promise<PracticeManagedQuestionnaireImportJsonOutput> {
  const { questionnaire, questionnaireUrl, existingQuestionnaireId, existingVersion } = input;

  const previousVersion = existingVersion ?? PRACTICE_MANAGED_QUESTIONNAIRE_BASE_VERSION;

  // respect a version the user already bumped in the json, otherwise patch
  const nextVersion =
    questionnaire.version && compareVersions(questionnaire.version, previousVersion) > 0
      ? questionnaire.version
      : patchQuestionnaireVersion(previousVersion);
  console.log(`previous version ${previousVersion}, next version ${nextVersion}`);

  // questionnaire uploaded with next version
  const createRequest: BatchInputPostRequest<Questionnaire> = {
    method: 'POST',
    url: '/Questionnaire',
    resource: {
      ...questionnaire,
      version: nextVersion,
    },
  };

  // retire the existing version
  const retireRequests: BatchInputPatchRequest<Questionnaire>[] = [
    {
      method: 'PATCH',
      url: `Questionnaire/${existingQuestionnaireId}`,
      operations: [{ op: 'replace', path: '/status', value: 'retired' }],
    },
  ];

  console.log('checking if form is contained in any flows');
  const flowRequests: BatchInputRequest<Questionnaire>[] = await handleFormInFlows({
    previousVersion,
    nextVersion,
    url: questionnaireUrl,
    oystehr,
  });
  console.log(
    `Flows containing the target form that will be updated: ${
      flowRequests.length > 0 ? `${flowRequests.map((request) => request.url)}` : 'none'
    }`
  );

  console.log(
    `Creating version ${nextVersion} of "${questionnaireUrl}", "superseding" Questionnaire/${existingQuestionnaireId}`
  );
  const res = (
    await oystehr.fhir.transaction<Questionnaire>({
      requests: [...retireRequests, createRequest, ...flowRequests],
    })
  ).unbundle();

  const created = res.find(
    (resource): resource is Questionnaire =>
      resource.resourceType === 'Questionnaire' && resource.url === questionnaireUrl && resource.version === nextVersion
  );

  if (!created?.id) {
    throw new Error(
      `Failed to find the created questionnaire in the transaction response for ${questionnaireUrl}|${nextVersion}`
    );
  }

  return { questionnaireId: created.id, version: nextVersion };
}
