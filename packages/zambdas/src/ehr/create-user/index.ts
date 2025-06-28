import { APIGatewayProxyResult } from 'aws-lambda';
import { CreateUserOutput, getSecret, SecretsKeys } from 'utils';
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
      throw new Error('Staff role not found');
    }

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

    const response: CreateUserOutput = {
      userID: user.id,
    };

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    await topLevelCatch('create-user', error, ENVIRONMENT);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error creating user' }),
    };
  }
});
