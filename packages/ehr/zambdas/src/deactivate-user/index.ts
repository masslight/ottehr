import { User } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Secrets, getSecret } from 'zambda-utils';
import { getAuth0Token } from '../shared';
import { topLevelCatch } from '../shared/errors';
import { ZambdaInput } from 'zambda-utils';
import { validateRequestParameters } from './validateRequestParameters';
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

    // Deactivate zapEHR user by assigning Inactive role
    const userRoles = (user as any).roles;
    const userRoleIds = userRoles.map((role: any) => role.id);
    const userInactive = userRoles.find((role: any) => role.name === 'Inactive');
    if (!userInactive) {
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

      console.log('searching for Inactive role in the the project');
      const existingRolesResponse = await fetch(`${PROJECT_API}/iam/role`, {
        method: 'GET',
        headers: headers,
      });
      const existingRoles = await existingRolesResponse.json();
      if (!existingRolesResponse.ok) {
        throw new Error('Error searching for existing roles');
      }

      const inactiveRole = existingRoles.find((role: any) => role.name === 'Inactive');
      if (!inactiveRole) {
        throw new Error('Error searching for Inactive role');
      }

      console.log('deactivating user');
      const updatedUserResponse = await fetch(`${PROJECT_API}/user/${user.id}`, {
        method: 'PATCH',
        headers: headers,
        body: JSON.stringify({
          roles: [...userRoleIds, inactiveRole.id],
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
