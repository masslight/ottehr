import Oystehr, { BatchInputPatchRequest, BatchInputPostRequest, BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { Operation } from 'fast-json-patch';
import { ActivityDefinition, Provenance } from 'fhir/r4b';
import {
  ADMIN_IN_HOUSE_LAB_MISSING_ROLE_ERROR,
  AdminEditInHouseLab,
  AdminInHouseLabConfigOutput,
  AdminUpdateInHouseLabInput,
  AdminUpdateInHouseLabStatus,
  APIErrorCode,
  getSecret,
  IN_HOUSE_LAB_LATEST_TAG_DEFINITION,
  isApiError,
  RoleType,
  Secrets,
  SecretsKeys,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  checkUserHasProvidedRoles,
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

  let validatedParameters: AdminUpdateInHouseLabInput & { secrets: Secrets | null; userToken: string };

  try {
    validatedParameters = validateRequestParameters(input);
  } catch (error: any) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: `Invalid request parameters. ${error.message || error}`,
      }),
    };
  }

  try {
    const { secrets, userId, data: dataAndUpdateType } = validatedParameters;

    console.log('validateRequestParameters success');

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    const userHasCorrectRoles = await checkUserHasProvidedRoles(oystehr, userId, [RoleType.Administrator]);
    if (!userHasCorrectRoles) {
      throw ADMIN_IN_HOUSE_LAB_MISSING_ROLE_ERROR();
    }

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

    if (isApiError(error) && error.code === APIErrorCode.NOT_AUTHORIZED) {
      return {
        statusCode: 403,
        body: JSON.stringify({
          message: error.message,
        }),
      };
    }

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
    oldActivityDefinition.meta?.tag?.filter(
      (tag) =>
        tag.system !== IN_HOUSE_LAB_LATEST_TAG_DEFINITION.system && tag.code !== IN_HOUSE_LAB_LATEST_TAG_DEFINITION.code
    ) ?? [];

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
  };
  requests.push(oldAdPatchRequest);

  // grab the old version and increment it -- we've been doing patch to date
  const incrementedVersion = semverToString(incrementSemVer(parseSemVer(versionToRetire), 'patch'));

  // make a new AD from the new data config. add the latest tag, and update the canonical url --
  // this is to keep the url consistent in case the user edits the test name. Add the updated version
  const newAdFullUrl = `urn:uuid:${randomUUID()}`;
  const newAdWithEdits = convertAdminInHouseLabItemDefinitionToActivityDefinition(newData);
  newAdWithEdits.version = incrementedVersion;
  newAdWithEdits.url = canonicalUrl;

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

  const transactionResult = await oystehr.fhir.transaction<ActivityDefinition | Provenance>({ requests });
  console.log('this was the transactionResult', JSON.stringify(transactionResult));

  const newWrittenAd = parseCreatedResourcesBundle(transactionResult).find(
    (res): res is ActivityDefinition =>
      res.resourceType === 'ActivityDefinition' && res.id !== undefined && res.id !== activityDefinitionIdToRetire
  );
  if (!newWrittenAd) throw new Error('New ActivityDefinition not in the transaction result');

  return newWrittenAd;
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

  return newWrittenAd as ActivityDefinition;
};
