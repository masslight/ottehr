import { APIGatewayProxyResult } from 'aws-lambda';
import { ActivityDefinition } from 'fhir/r4b';
import {
  ADMIN_IN_HOUSE_LAB_MISSING_ROLE_ERROR,
  AdminGetInHouseLabConfigInput,
  APIErrorCode,
  getSecret,
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
import { makeAdminInHouseLabConfigOutput } from '../../shared/in-house-labs';
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

    const userHasCorrectRoles = await checkUserHasProvidedRoles(oystehr, userId, [RoleType.Administrator]);
    if (!userHasCorrectRoles) {
      throw ADMIN_IN_HOUSE_LAB_MISSING_ROLE_ERROR();
    }

    const activityDefinition = await oystehr.fhir.get<ActivityDefinition>({
      resourceType: 'ActivityDefinition',
      id: activityDefinitionId,
    });

    const response = makeAdminInHouseLabConfigOutput(activityDefinition);

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
