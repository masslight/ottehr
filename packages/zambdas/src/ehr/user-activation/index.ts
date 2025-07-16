import { User } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { createFetchClientWithOystAuth, FetchClientWithOystAuth, getSecret, Secrets, SecretsKeys } from 'utils';
import { UserActivationZambdaInput, UserActivationZambdaOutput } from 'utils/lib/types/api/user-activation.types';
import { checkOrCreateM2MClientToken, topLevelCatch, wrapHandler, ZambdaInput } from '../../shared';
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

    await checkOrCreateM2MClientToken(oystehrToken, validatedParameters.secrets);
    const PROJECT_API = getSecret('PROJECT_API', validatedParameters.secrets);
    const fetchClient = createFetchClientWithOystAuth({ authToken: oystehrToken });
    const user = await fetchClient.oystFetch<User>('GET', `${PROJECT_API}/user/${validatedParameters.userId}`);

    let response: UserActivationZambdaOutput = {};
    if (validatedParameters.mode === 'activate') {
      response = await activateUser(user, fetchClient, PROJECT_API);
    } else if (validatedParameters.mode === 'deactivate') {
      response = await deactivateUser(user, fetchClient, PROJECT_API);
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
  user: User,
  client: FetchClientWithOystAuth,
  projectApi: string
): Promise<UserActivationZambdaOutput> {
  // Deactivate Oystehr user by assigning Inactive role
  const userRoles = (user as any).roles;
  const userRoleIds = userRoles.map((role: any) => role.id);
  const userInactive = userRoles.find((role: any) => role.name === 'Inactive');
  if (!userInactive) {
    console.log('searching for Inactive role in the the project');
    let existingRoles;
    try {
      existingRoles = await client.oystFetch('GET', `${projectApi}/iam/role`);
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
      await client.oystFetch('PATCH', `${projectApi}/user/${user.id}`, {
        roles: [...userRoleIds, inactiveRole.id],
      });
    } catch (error) {
      console.error(error);
      throw new Error('Failed to deactivate user');
    }
  } else {
    console.log('User is already deactivated. Skipping.');
  }

  return {};
}

async function activateUser(
  user: User,
  client: FetchClientWithOystAuth,
  projectApi: string
): Promise<UserActivationZambdaOutput> {
  // Activating Oystehr user by removing Inactive role
  const userRoles = (user as any).roles;
  const userInactive = userRoles.find((role: any) => role.name === 'Inactive');
  if (userInactive) {
    const userRoleIds = userRoles.filter((role: any) => role.id !== userInactive.id).map((role: any) => role.id);

    console.log('activating user');
    try {
      await client.oystFetch('PATCH', `${projectApi}/user/${user.id}`, {
        roles: [...userRoleIds],
      });
    } catch (error) {
      console.error(error);
      throw new Error('Failed to activate user');
    }
  } else {
    console.log('User is already active. Skipping.');
  }

  return {};
}
