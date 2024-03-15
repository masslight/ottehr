import { APIGatewayProxyResult } from 'aws-lambda';
import { Secrets, ZambdaInput } from '../types';
import { validateRequestParameters } from './validateRequestParameters';
import { getAuth0Token, getSecret } from '../shared';
import { User } from '@zapehr/sdk';
import { topLevelCatch } from '../shared/errors';
export interface DeactivateUserInput {
  secrets: Secrets | null;
  user: User;
  // locations: Location[];
}

let zapehrToken: string;
export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { secrets, user } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    // Deactivate zapEHR user by removing roles
    if ((user as any).roles.length > 0) {
      if (!zapehrToken) {
        console.log('getting token');
        zapehrToken = await getAuth0Token(secrets);
      } else {
        console.log('already have token');
      }

      const PROJECT_API = getSecret('PROJECT_API', secrets);
      const headers = {
        accept: 'application/json',
        'content-type': 'application/json',
        Authorization: `Bearer ${zapehrToken}`,
      };
      const updatedUserResponse = await fetch(`${PROJECT_API}/user/${user.id}`, {
        method: 'PATCH',
        headers: headers,
        body: JSON.stringify({
          roles: [],
        }),
      });
      console.log(await updatedUserResponse.json());
      if (!updatedUserResponse.ok) {
        throw new Error('Failed to deactivate user');
      }
    }

    const response = {
      message: `Successfully deactivated user ${user.id}`,
    };

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    await topLevelCatch('admin-deactivate-user', error, input.secrets);
    console.log('Error: ', JSON.stringify(error.message));
    return {
      statusCode: 500,
      body: JSON.stringify(error.message),
    };
  }
};
