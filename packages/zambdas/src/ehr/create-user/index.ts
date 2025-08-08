import { APIGatewayProxyResult } from 'aws-lambda';
import { APIError, APIErrorCode, CreateUserOutput, getSecret, SecretsKeys, USER_ALREADY_EXISTS_ERROR } from 'utils';
import { checkOrCreateM2MClientToken, topLevelCatch, wrapHandler, ZambdaInput } from '../../shared';
import { createOystehrClient } from '../../shared/helpers';
import { validateRequestParameters } from './validateRequestParameters';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;
export const index = wrapHandler('create-user', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const validatedInput = validateRequestParameters(input);
    const { email, applicationID, firstName, lastName, secrets } = validatedInput;

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);
    const roles = await oystehr.role.list();
    const staffRole = roles.find((role) => role.name === 'Staff');
    if (!staffRole) {
      throw {
        code: APIErrorCode.INVALID_INPUT,
        message: 'Staff role not found',
        statusCode: 500,
      } satisfies APIError;
    }

    let userId: string;

    try {
      const user = await oystehr.user.invite({
        email: email,
        resource: {
          resourceType: 'Practitioner',
          name: [
            {
              family: lastName,
              given: [firstName],
            },
          ],
        },
        applicationId: applicationID,
        roles: [staffRole.id],
      });
      userId = user.id;
    } catch (error: any) {
      if (error?.code === '4004' || error?.message?.includes('already a member')) {
        throw {
          ...USER_ALREADY_EXISTS_ERROR,
          statusCode: 409,
        } satisfies APIError;
      }

      throw {
        code: APIErrorCode.INVALID_INPUT,
        message: `Failed to create user: ${error?.message ?? 'Unknown error'}`,
        statusCode: 400,
      } satisfies APIError;
    }

    const response: CreateUserOutput = {
      userID: userId,
    };

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: unknown) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return await topLevelCatch('create-user', error, ENVIRONMENT);
  }
});
