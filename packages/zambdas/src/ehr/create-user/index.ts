import { APIGatewayProxyResult } from 'aws-lambda';
import { CreateUserOutput } from 'utils';
import { createOystehrClient } from '../../shared/helpers';
import { validateRequestParameters } from './validateRequestParameters';
import { checkOrCreateM2MClientToken, topLevelCatch, ZambdaInput } from '../../shared';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mtoken: string;
export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const validatedInput = validateRequestParameters(input);
    const { email, applicationID, firstName, lastName, secrets } = validatedInput;

    m2mtoken = await checkOrCreateM2MClientToken(m2mtoken, secrets);
    const oystehr = createOystehrClient(m2mtoken, secrets);

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
      roles: [],
    });

    const response: CreateUserOutput = {
      userID: user.id,
    };

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    await topLevelCatch('create-user', error, input.secrets);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error creating user' }),
    };
  }
};
