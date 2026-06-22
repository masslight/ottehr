import Oystehr, { BatchInputPatchRequest, BatchInputPostRequest, BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { Operation } from 'fast-json-patch';
import { ActivityDefinition, Provenance } from 'fhir/r4b';
import {
  AdminEditInHouseLab,
  AdminInHouseLabConfigOutput,
  AdminUpdateInHouseLabInput,
  AdminUpdateInHouseLabStatus,
  getApiError,
  getSecret,
  IN_HOUSE_LAB_LATEST_TAG_DEFINITION,
  INVALID_INPUT_ERROR,
  makeOptimisticLockIfMatchHeader,
  Secrets,
  SecretsKeys,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  parseCreatedResourcesBundle,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../../../shared';
import {
  convertAdminInHouseLabItemDefinitionToActivityDefinition,
  incrementSemVer,
  makeAdminInHouseLabConfigOutput,
  makeAdminProvenanceResourceRequest,
  parseSemVer,
  semverToString,
} from '../../shared/in-house-labs';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'admin-update-in-house-lab';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`admin-update-in-house-lab started, input: ${JSON.stringify(input)}`);

  try {
    const validatedParameters: AdminUpdateInHouseLabInput & { secrets: Secrets | null; userToken: string } =
      validateRequestParameters(input);

    const { secrets, userId, data: dataAndUpdateType } = validatedParameters;

    console.log('validateRequestParameters success');

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    let mutatedActivityDefinition: ActivityDefinition;
    if (dataAndUpdateType.updateType === 'edit') {
      mutatedActivityDefinition = await handleEditAdminInHouseLab(oystehr, dataAndUpdateType, userId);
    } else if (dataAndUpdateType.updateType === 'toggle-status') {
      mutatedActivityDefinition = await handleStatusUpdateAdminInHouseLab(oystehr, dataAndUpdateType, userId);
    } else {
      throw new Error('Unrecognized update type');
    }

    console.log(
      `this is the mutated activity definition after the ${JSON.stringify(dataAndUpdateType.updateType)}`,
      JSON.stringify(mutatedActivityDefinition)
    );

    const response: AdminInHouseLabConfigOutput = makeAdminInHouseLabConfigOutput(mutatedActivityDefinition);
    console.log('admin-update-in-house-lab response', JSON.stringify(response));

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    console.error('Error in admin-update-in-house-lab', error);

    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('admin-update-in-house-lab', error, ENVIRONMENT);
  }
});

const handleEditAdminInHouseLab = async (
  oystehr: Oystehr,
  dataAndUpdateType: AdminEditInHouseLab,
  userId: string
): Promise<ActivityDefinition> => {
  console.log('handling edit in house lab');
  console.log('this is the data', JSON.stringify(dataAndUpdateType.data));

  const requests: BatchInputRequest<ActivityDefinition | Provenance>[] = [];

  const { activityDefinitionIdToRetire, versionToRetire, canonicalUrl, newData } = dataAndUpdateType.data;

  // grab the old AD, update its status to retired and remove the latest tag
  const oldActivityDefinition = await oystehr.fhir.get<ActivityDefinition>({
    resourceType: 'ActivityDefinition',
    id: activityDefinitionIdToRetire,
  });

  const oldAdTagsMinusLatest =
    oldActivityDefinition.meta?.tag?.filter((tag) => {
      if (tag.system === IN_HOUSE_LAB_LATEST_TAG_DEFINITION.system)
        return tag.code !== IN_HOUSE_LAB_LATEST_TAG_DEFINITION.code;
      return true;
    }) ?? [];
  console.log('These are the oldAdTagsMinusLatest', JSON.stringify(oldAdTagsMinusLatest));

  const oldAdPatchRequest: BatchInputPatchRequest<ActivityDefinition> = {
    method: 'PATCH',
    url: `ActivityDefinition/${activityDefinitionIdToRetire}`,
    operations: [
      {
        path: '/status',
        op: 'replace',
        value: 'retired',
      },
      ...(oldAdTagsMinusLatest.length
        ? [
            {
              path: '/meta/tag',
              op: 'replace',
              value: oldAdTagsMinusLatest,
            } as Operation,
          ]
        : [
            {
              path: '/meta/tag',
              op: 'remove',
            } as Operation,
          ]),
    ],
    ifMatch: makeOptimisticLockIfMatchHeader(oldActivityDefinition),
  };
  requests.push(oldAdPatchRequest);

  // grab the old version and increment it -- we've been doing patch to date
  const incrementedVersion = semverToString(incrementSemVer(parseSemVer(versionToRetire), 'patch'));

  // make a new AD from the new data config. add the latest tag, and update the canonical url --
  // this is to keep the url consistent in case the user edits the test name. Add the updated version
  const newAdFullUrl = `urn:uuid:${randomUUID()}`;
  const newAd = convertAdminInHouseLabItemDefinitionToActivityDefinition(newData);

  const existingTags = newAd.meta?.tag ?? [];
  console.log('These are the existing tags for the newAd', JSON.stringify(existingTags));

  const newAdWithEdits: ActivityDefinition = {
    ...newAd,
    version: incrementedVersion,
    url: canonicalUrl,
    meta: {
      ...newAd.meta,
      tag: [...existingTags, IN_HOUSE_LAB_LATEST_TAG_DEFINITION],
    },
  };

  const createNewAdRequest: BatchInputPostRequest<ActivityDefinition> = {
    method: 'POST',
    url: '/ActivityDefinition',
    fullUrl: newAdFullUrl,
    resource: newAdWithEdits,
  };
  requests.push(createNewAdRequest);

  // make a provenance
  requests.push(
    makeAdminProvenanceResourceRequest(
      [`ActivityDefinition/${activityDefinitionIdToRetire}`, newAdFullUrl],
      userId,
      'EDIT'
    )
  );

  try {
    const transactionResult = await oystehr.fhir.transaction<ActivityDefinition | Provenance>({ requests });
    console.log('this was the transactionResult', JSON.stringify(transactionResult));

    const newWrittenAd = parseCreatedResourcesBundle(transactionResult).find(
      (res): res is ActivityDefinition =>
        res.resourceType === 'ActivityDefinition' && res.id !== undefined && res.id !== activityDefinitionIdToRetire
    );
    if (!newWrittenAd) throw new Error('New ActivityDefinition not in the transaction result');

    return newWrittenAd;
  } catch (e: any) {
    console.error('Encountered error when making transaction request updating in house lab. Error:', e);
    const error = getApiError({ error: e, defaultError: 'Something went wrong updating the in house lab' });
    if (error.toLowerCase().includes('invalid')) throw INVALID_INPUT_ERROR(error);
    else throw new Error(error);
  }
};

const handleStatusUpdateAdminInHouseLab = async (
  oystehr: Oystehr,
  dataAndUpdateType: AdminUpdateInHouseLabStatus,
  userId: string
): Promise<ActivityDefinition> => {
  console.log('handling update in house lab');
  console.log('this is the data', JSON.stringify(dataAndUpdateType.data));
  const activityDefinitionId = dataAndUpdateType.data.activityDefinitionId;

  const requests: BatchInputRequest<ActivityDefinition | Provenance>[] = [];
  const activityDefinition = await oystehr.fhir.get<ActivityDefinition>({
    resourceType: 'ActivityDefinition',
    id: activityDefinitionId,
  });

  const toggleStatusRequest: BatchInputPatchRequest<ActivityDefinition> = {
    method: 'PATCH',
    url: `ActivityDefinition/${activityDefinitionId}`,
    operations: [
      {
        path: '/status',
        op: 'replace',
        value: activityDefinition.status === 'active' ? 'retired' : 'active',
      },
    ],
    ifMatch: makeOptimisticLockIfMatchHeader(activityDefinition),
  };
  requests.push(toggleStatusRequest);

  requests.push(
    makeAdminProvenanceResourceRequest([`ActivityDefinition/${activityDefinitionId}`], userId, 'TOGGLE-STATUS')
  );

  const transactionResult = await oystehr.fhir.transaction<ActivityDefinition | Provenance>({ requests });
  console.log('this was the transactionResult', JSON.stringify(transactionResult));

  const newWrittenAd = parseCreatedResourcesBundle(transactionResult).find(
    (res): res is ActivityDefinition => res.resourceType === 'ActivityDefinition'
  );
  if (!newWrittenAd) throw new Error('New ActivityDefinition not in the transaction result');

  return newWrittenAd;
};
