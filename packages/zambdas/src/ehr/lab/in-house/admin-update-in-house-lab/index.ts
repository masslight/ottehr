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
  getSecret,
  IN_HOUSE_LAB_LATEST_TAG_DEFINITION,
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
  SemVer,
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

  // there is an edge case due to previously TF-managed ActivityDefinitions:
  // they did not previously have latest tags assigned to them even when they are in fact the latest,
  // so we will take this opportunity to assign the tag if it is in fact the latest version --
  // otherwise they are filtered out in list view once retired
  const shouldAddLatestTag = await isLatestVersionMissingLatestTag(oystehr, activityDefinition);
  if (shouldAddLatestTag)
    console.log(
      `ActivityDefinition/${activityDefinition.id} is the latest version but missing its tag. Adding the tag`
    );
  const activityDefinitionHasTags = !!activityDefinition.meta?.tag?.length;

  const toggleStatusRequest: BatchInputPatchRequest<ActivityDefinition> = {
    method: 'PATCH',
    url: `ActivityDefinition/${activityDefinitionId}`,
    operations: [
      {
        path: '/status',
        op: 'replace',
        value: activityDefinition.status === 'active' ? 'retired' : 'active',
      },
      ...(shouldAddLatestTag
        ? [
            {
              path: activityDefinitionHasTags ? '/meta/tag/-' : '/meta/tag',
              op: 'add',
              value: activityDefinitionHasTags
                ? IN_HOUSE_LAB_LATEST_TAG_DEFINITION
                : [IN_HOUSE_LAB_LATEST_TAG_DEFINITION],
            } as Operation,
          ]
        : []),
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

const isLatestVersionMissingLatestTag = async (
  oystehr: Oystehr,
  activityDefinition: ActivityDefinition
): Promise<boolean> => {
  const hasLatestTag =
    activityDefinition.meta?.tag?.some(
      (tag) =>
        tag.system === IN_HOUSE_LAB_LATEST_TAG_DEFINITION.system && tag.code === IN_HOUSE_LAB_LATEST_TAG_DEFINITION.code
    ) || false;

  if (hasLatestTag) return false;

  const canonicalUrl = activityDefinition.url;
  const version = activityDefinition.version;
  if (!canonicalUrl || !version)
    throw new Error(`ActivityDefinition/${activityDefinition.id} is missing its canonical url or version`);

  // find all the other activityDefinitions with the same canonical url, and then remove our current one from the list
  // unfortunately we can't have fhir sort by version because at some point we switched from incremental versions to semver
  // and fhir does a simple string comparison sort
  const adsByUrl = (
    await oystehr.fhir.search<ActivityDefinition>({
      resourceType: 'ActivityDefinition',
      params: [
        {
          name: 'url',
          value: canonicalUrl,
        },
      ],
    })
  )
    .unbundle()
    .filter((ad) => ad.id !== activityDefinition.id);

  if (!adsByUrl.length) return true;

  const allVersions = adsByUrl.map((ad) => ad.version).filter((elm) => elm !== undefined);
  const higherVersionExists = allVersions.some((v) => isGreaterSemVer(v, version));
  return !higherVersionExists;
};

/**
 * Tells you if x is a greater semver than y
 * */
const isGreaterSemVer = (x: string, y: string): boolean => {
  let semVerX: SemVer, semVerY: SemVer;
  try {
    semVerX = parseSemVer(x);
  } catch (error: any) {
    // not a real semVer, so can't be greater
    console.log('x semver was not a real semver', error);
    return false;
  }

  try {
    semVerY = parseSemVer(y);
  } catch (error) {
    // if y isn't a semver, x is greater by default
    console.log('y semver was not a real semver', error);
    return true;
  }
  const { major: majorX, minor: minorX, patch: patchX } = semVerX;
  const { major: majorY, minor: minorY, patch: patchY } = semVerY;

  if (majorX !== majorY) return majorX > majorY;
  if (minorX !== minorY) return minorX > minorY;
  return patchX > patchY;
};
