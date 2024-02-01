import { APIGatewayProxyResult } from 'aws-lambda';
import { Secrets, ZambdaInput } from '../types';
//import { RoleType } from '../../../app/src/types/types';
import { RoleType } from '../shared/rolesUtils';
import { validateRequestParameters } from './validateRequestParameters';
import { getRoleId } from '../shared/rolesUtils';
import { getAuth0Token, getSecret } from '../shared';
import { topLevelCatch } from '../shared/errors';

export interface UpdateUserInput {
  secrets: Secrets | null;
  userId: string;
  selectedRole?: RoleType;
  // locations: Location[];
}

let zapehrToken: string;
export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { secrets, userId, selectedRole } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');
    const PROJECT_API = getSecret('PROJECT_API', secrets);
    if (!zapehrToken) {
      console.log('getting token');
      zapehrToken = await getAuth0Token(secrets);
    } else {
      console.log('already have token');
    }
    const headers = {
      accept: 'application/json',
      'content-type': 'application/json',
      Authorization: `Bearer ${zapehrToken}`,
    };

    // Update user's zapEHR roles
    // If there is a selectedRole, the user is currently active. Update their role to the selected one.
    // If there is no selectedRole, the user is currently deactivated. Re-activate them with zero roles.
    let roles: string[] = [];

    if (selectedRole) {
      const roleId = await getRoleId(selectedRole, zapehrToken, PROJECT_API);
      roles = [roleId];
    }
    const updatedUserResponse = await fetch(`${PROJECT_API}/user/${userId}`, {
      method: 'PATCH',
      headers: headers,
      body: JSON.stringify({
        roles: roles,
      }),
    });
    console.log(await updatedUserResponse.json());
    if (!updatedUserResponse.ok) {
      throw new Error('Failed to update user');
    }
    const response = {
      message: `Successfully updated user ${userId}`,
    };

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    await topLevelCatch('admin-update-user', error, input.secrets);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
