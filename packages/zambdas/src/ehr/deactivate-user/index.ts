import { APIGatewayProxyResult } from 'aws-lambda';
import { DeactivateUserZambdaInput, DeactivateUserZambdaOutput, getSecret, Secrets, SecretsKeys } from 'utils';
import { getAuth0Token, topLevelCatch, wrapHandler, ZambdaInput } from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';

export interface DeactivateUserZambdaInputValidated extends DeactivateUserZambdaInput {
  secrets: Secrets;
}

let oystehrToken: string;

export const index = wrapHandler('deactivate-user', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { secrets, user } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    // Deactivate Oystehr user by assigning Inactive role
    const userRoles = (user as any).roles;
    const userRoleIds = userRoles.map((role: any) => role.id);
    const userInactive = userRoles.find((role: any) => role.name === 'Inactive');
    if (!userInactive) {
      if (!oystehrToken) {
        console.log('getting token');
        oystehrToken = await getAuth0Token(secrets);
      } else {
        console.log('already have token');
      }

      const PROJECT_API = getSecret('PROJECT_API', secrets);
      const headers = {
        accept: 'application/json',
        'content-type': 'application/json',
        Authorization: `Bearer ${oystehrToken}`,
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

    const response: DeactivateUserZambdaOutput = {};

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    await topLevelCatch('admin-deactivate-user', error, ENVIRONMENT);
    console.log('Error: ', JSON.stringify(error.message));
    return {
      statusCode: 500,
      body: JSON.stringify(error.message),
    };
  }
});
