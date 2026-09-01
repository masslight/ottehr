import { BatchInputDeleteRequest, BatchInputPostRequest, BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Questionnaire } from 'fhir/r4b';
import { ensureSystemManagedTag, validateSystemManagedImport } from 'utils/lib/helpers/system-managed-questionnaires';
import { SaveSystemManagedDraftOutput } from 'utils/lib/types/data/system-managed-questionnaires/system-managed-questionnaire.types';
import { INVALID_INPUT_ERROR, MANAGED_QUESTIONNAIRE_ERROR } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { findCurrentActiveSystemManaged, findSystemManagedDrafts } from '../helpers';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'system-managed-questionnaire-save-draft';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`${ZAMBDA_NAME} started`);
  const { questionnaire, secrets } = validateRequestParameters(input);
  console.log('validateRequestParameters success');

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const url = questionnaire.url as string;

  // locate the current active version this draft is meant to supersede
  const current = await findCurrentActiveSystemManaged(oystehr, url);
  if (!current) {
    throw MANAGED_QUESTIONNAIRE_ERROR(`No active system-managed questionnaire found for url ${url}.`);
  }

  // authoritative re-validation (client validates too, but never trust the client)
  const validation = validateSystemManagedImport({ imported: questionnaire, current });
  if (!validation.ok) {
    throw INVALID_INPUT_ERROR(`Draft failed validation:\n- ${validation.errors.join('\n- ')}`);
  }

  // upsert: importing a new draft clears any previously-saved draft for this url
  const existingDrafts = await findSystemManagedDrafts(oystehr, url);
  const deleteRequests: BatchInputDeleteRequest[] = existingDrafts
    .filter((d) => d.id)
    .map((d) => ({ method: 'DELETE', url: `Questionnaire/${d.id}` }));

  const { id: _id, ...withoutId } = validation.imported;
  const draftResource = ensureSystemManagedTag({ ...withoutId, status: 'draft' });

  const createRequest: BatchInputPostRequest<Questionnaire> = {
    method: 'POST',
    url: '/Questionnaire',
    resource: draftResource,
  };

  console.log(`Saving draft ${draftResource.version} for ${url}; clearing ${deleteRequests.length} existing draft(s)`);
  const requests: BatchInputRequest<Questionnaire>[] = [...deleteRequests, createRequest];
  const results = (await oystehr.fhir.transaction<Questionnaire>({ requests })).unbundle();

  const createdDraft = results.find(
    (resource): resource is Questionnaire =>
      resource.resourceType === 'Questionnaire' &&
      resource.status === 'draft' &&
      resource.version === draftResource.version
  );

  if (!createdDraft?.id) {
    throw MANAGED_QUESTIONNAIRE_ERROR('Draft was not created as expected.');
  }

  const response: SaveSystemManagedDraftOutput = { draftId: createdDraft.id };
  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});
