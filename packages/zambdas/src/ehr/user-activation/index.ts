import { User } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { createFetchClientWithOystAuth, FetchClientWithOystAuth, getSecret, Secrets, SecretsKeys } from 'utils';
import { UserActivationZambdaInput, UserActivationZambdaOutput } from 'utils/lib/types/api/user-activation.types';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';

export interface UserActivationZambdaInputValidated extends UserActivationZambdaInput {
  secrets: Secrets;
}

let oystehrToken: string;

export const index = wrapHandler('user-activation', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { userId, mode, secrets } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    oystehrToken = await checkOrCreateM2MClientToken(oystehrToken, secrets);
    const PROJECT_API = getSecret('PROJECT_API', secrets);
    const oystehr = createOystehrClient(oystehrToken, secrets);
    const fetchClient = createFetchClientWithOystAuth({ authToken: oystehrToken });
    let user = await oystehr.user.get({ id: userId });
    console.log(`user before ${mode}ing: `, JSON.stringify(user));

    let response: UserActivationZambdaOutput = {};
    if (mode === 'activate') {
      response = await activateUser(user, fetchClient, PROJECT_API);
    } else if (mode === 'deactivate') {
      response = await deactivateUser(user, fetchClient, PROJECT_API);
    }

    user = await oystehr.user.get({ id: userId });
    console.log(`user after ${mode}ing: `, JSON.stringify(user));

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
    return { message: 'User is already deactivated.' };
  }

  return { message: 'User successfully deactivated.' };
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
    return { message: 'User is already activated.' };
  }

  return { message: 'User successfully activated.' };
}
