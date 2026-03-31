import { APIGatewayProxyResult } from 'aws-lambda';
import { ActivityDefinition } from 'fhir/r4b';
import {
  ADMIN_IN_HOUSE_LAB_MISSING_ROLE_ERROR,
  AdminGetInHouseLabConfigInput,
  AdminGetInHouseLabConfigOutput,
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
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../../../shared';
import { parseActivityDefinitionToAdminInHouseLabItemDef } from '../../shared/in-house-labs';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'admin-get-in-house-lab-config';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`admin-get-in-house-lab-config started, input: ${JSON.stringify(input)}`);
  let validatedParameters: AdminGetInHouseLabConfigInput & { secrets: Secrets | null; userToken: string };

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
    const { secrets, userId, activityDefinitionId } = validatedParameters;

    console.log('validateRequestParameters success');

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    if (!checkUserHasProvidedRoles(oystehr, userId, [RoleType.Administrator])) {
      throw ADMIN_IN_HOUSE_LAB_MISSING_ROLE_ERROR();
    }

    // get the activitydefinition by id
    // determine if it's the latest
    // convert to the proper config

    // ATHENA TODO: test what happens if this gets a bogus AD id
    const activityDefinition = await oystehr.fhir.get<ActivityDefinition>({
      resourceType: 'ActivityDefinition',
      id: activityDefinitionId,
    });

    const isLatest =
      activityDefinition.meta?.tag?.some(
        (tag) =>
          tag.system === IN_HOUSE_LAB_LATEST_TAG_DEFINITION.system &&
          tag.code === IN_HOUSE_LAB_LATEST_TAG_DEFINITION.code
      ) || false;

    const testConfig = parseActivityDefinitionToAdminInHouseLabItemDef(activityDefinition);
    const canonicalUrl = activityDefinition.url;
    if (!canonicalUrl) {
      console.error(`ActivityDefinition/${activityDefinitionId} missing canonical url`);
      throw new Error('Misconfigured ActivityDefinition is missing its url');
    }
    const version = activityDefinition.version;
    if (!version) {
      console.error(`ActivityDefinition/${activityDefinitionId} missing version`);
      throw new Error('Misconfigured ActivityDefinition is missing its version');
    }

    const response: AdminGetInHouseLabConfigOutput = {
      activityDefinitionId: activityDefinition.id || '',
      canonicalUrl,
      version,
      isLatest,
      testConfig,
    };

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    console.error('Error in admin-get-in-house-lab-config', error);

    if (isApiError(error) && error.code === APIErrorCode.NOT_AUTHORIZED) {
      return {
        statusCode: 403,
        body: JSON.stringify({
          message: error.message,
        }),
      };
    }

    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('admin-get-in-house-lab-config', error, ENVIRONMENT);
  }
});
