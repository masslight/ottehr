import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { ActivityDefinition } from 'fhir/r4b';
import {
  ADMIN_IN_HOUSE_LAB_MISSING_ROLE_ERROR,
  AdminListInHouseLabsInput,
  AdminListInHouseLabsOutput,
  APIErrorCode,
  getSecret,
  IN_HOUSE_LAB_LATEST_TAG_DEFINITION,
  IN_HOUSE_TAG_DEFINITION,
  InHouseLabsAdminListItem,
  isApiError,
  RoleType,
  Secrets,
  SecretsKeys,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  checkUserHasProvidedRoles,
  createOystehrClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'admin-list-in-house-labs';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`admin-list-in-house-labs started, input: ${JSON.stringify(input)}`);
  let validatedParameters: AdminListInHouseLabsInput & { secrets: Secrets | null; userToken: string };

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
    const { secrets, userId } = validatedParameters;

    console.log('validateRequestParameters success');

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    if (!checkUserHasProvidedRoles(oystehr, userId, [RoleType.Administrator])) {
      throw ADMIN_IN_HOUSE_LAB_MISSING_ROLE_ERROR();
    }

    const response: AdminListInHouseLabsOutput = { labs: await getAdminInHouseLabItemList(oystehr) };

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    console.error('Error in admin-list-in-house-labs', error);

    if (isApiError(error) && error.code === APIErrorCode.NOT_AUTHORIZED) {
      return {
        statusCode: 403,
        body: JSON.stringify({
          message: error.message,
        }),
      };
    }

    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('admin-list-in-house-labs', error, ENVIRONMENT);
  }
});

const getAdminInHouseLabItemList = async (oystehr: Oystehr): Promise<InHouseLabsAdminListItem[]> => {
  const response = (
    await oystehr.fhir.search<ActivityDefinition>({
      resourceType: 'ActivityDefinition',
      params: [
        {
          name: '_tag',
          value: `${IN_HOUSE_TAG_DEFINITION.system}|${IN_HOUSE_TAG_DEFINITION.code}`,
        },
      ],
    })
  ).unbundle();

  // we assume that all the active ADs are automatically 'latest'
  const activeActivityDefinitions = response.filter((res) => res.status === 'active');
  const latestRetiredActivityDefinitions = response.filter(
    (res) =>
      res.status === 'retired' &&
      res.meta?.tag?.some(
        (tag) =>
          tag.system === IN_HOUSE_LAB_LATEST_TAG_DEFINITION.system &&
          tag.code === IN_HOUSE_LAB_LATEST_TAG_DEFINITION.code
      )
  );

  const activityDefinitions = [...activeActivityDefinitions, ...latestRetiredActivityDefinitions];
  console.log(`All ActivityDefinitions for admin: ${JSON.stringify(activityDefinitions.map((ad) => ad.id))}`);

  const urlAndVersionExist = (ad: ActivityDefinition): ad is ActivityDefinition & { url: string; version: string } => {
    return !!ad.version && !!ad.url;
  };

  const adminLabListItems: InHouseLabsAdminListItem[] = [];

  activityDefinitions.forEach((ad) => {
    if (!urlAndVersionExist(ad)) {
      console.warn(`ActivityDefinition/${ad.id} missing either its canonical url or its version. Skipping`);
      return;
    }

    if (ad.status !== 'active' && ad.status !== 'retired') {
      console.warn(`ActivityDefinition/${ad.id} was in an unrecognized status: ${ad.status}. Skipping`);
      return;
    }

    if (!ad.id) return;

    adminLabListItems.push({
      name: ad.name ?? 'No name provided',
      status: ad.status,
      canonicalUrl: ad.url,
      version: ad.version,
      activityDefinitionId: ad.id,
    });
  });

  adminLabListItems.sort((a, b): number => {
    if (a.name < b.name) return -1;
    else if (a.name > b.name) return 1;
    else return 0;
  });

  console.log(`Final adminLabListItems: ${JSON.stringify(adminLabListItems)}`);

  return adminLabListItems;
};
