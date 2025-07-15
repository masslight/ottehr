import { APIGatewayProxyResult } from 'aws-lambda';
import { createFetchClientWithOystAuth, getSecret, Secrets, SecretsKeys } from 'utils';
import { UserActivationZambdaInput, UserActivationZambdaOutput } from 'utils/lib/types/api/user-activation.types';
import { getAuth0Token, topLevelCatch, wrapHandler, ZambdaInput } from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';

export interface UserActivationZambdaInputValidated extends UserActivationZambdaInput {
  secrets: Secrets;
}

let oystehrToken: string;

export const index = wrapHandler('user-activation', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    console.groupEnd();
    console.debug('validateRequestParameters success');

    if (!oystehrToken) {
      console.log('getting token');
      oystehrToken = await getAuth0Token(validatedParameters.secrets);
    } else {
      console.log('already have token');
    }

    let response: UserActivationZambdaOutput = {};
    if (validatedParameters.mode === 'activate') {
      response = await activateUser(validatedParameters);
    } else if (validatedParameters.mode === 'deactivate') {
      response = await deactivateUser(validatedParameters);
    }

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    await topLevelCatch('admin-user-activation', error, ENVIRONMENT);
    console.log('Error: ', JSON.stringify(error.message));
    return {
      statusCode: 500,
      body: JSON.stringify(error.message),
    };
  }
});

async function deactivateUser(
  validatedParams: UserActivationZambdaInputValidated
): Promise<UserActivationZambdaOutput> {
  const { secrets, user } = validatedParams;

  // Deactivate Oystehr user by assigning Inactive role
  const userRoles = (user as any).roles;
  const userRoleIds = userRoles.map((role: any) => role.id);
  const userInactive = userRoles.find((role: any) => role.name === 'Inactive');
  if (!userInactive) {
    const { fetchClient } = createFetchClientWithOystAuth(oystehrToken);

    const PROJECT_API = getSecret('PROJECT_API', secrets);

    console.log('searching for Inactive role in the the project');
    let existingRoles;
    try {
      existingRoles = await fetchClient('GET', `${PROJECT_API}/iam/role`);
    } catch (error) {
      console.error(error);
      throw new Error('Error searching for existing roles');
    }

    const inactiveRole = existingRoles.find((role: any) => role.name === 'Inactive');
    if (!inactiveRole) {
      throw new Error('Error searching for Inactive role');
    }

    console.log('deactivating user');
    try {
      await fetchClient('PATCH', `${PROJECT_API}/user/${user.id}`, {
        roles: [...userRoleIds, inactiveRole.id],
      });
    } catch (error) {
      console.error(error);
      throw new Error('Failed to deactivate user');
    }
  }

  return {};
}

async function activateUser(validatedParams: UserActivationZambdaInputValidated): Promise<UserActivationZambdaOutput> {
  const { secrets, user } = validatedParams;

  // Activating Oystehr user by removing Inactive role
  const userRoles = (user as any).roles;
  const userInactive = userRoles.find((role: any) => role.name === 'Inactive');
  if (userInactive) {
    const { fetchClient } = createFetchClientWithOystAuth(oystehrToken);

    const PROJECT_API = getSecret('PROJECT_API', secrets);

    const userRoleIds = userRoles.filter((role: any) => role.id !== userInactive.id).map((role: any) => role.id);

    console.log('deactivating user');
    try {
      await fetchClient('PATCH', `${PROJECT_API}/user/${user.id}`, {
        roles: [...userRoleIds],
      });
    } catch (error) {
      console.error(error);
      throw new Error('Failed to deactivate user');
    }
  }

  return {};
}
