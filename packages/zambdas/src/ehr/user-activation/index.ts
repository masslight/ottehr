import Oystehr, { User } from '@oystehr/sdk';
import { captureMessage } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import { createFetchClientWithOystehrAuth, FetchClientWithOysterAuth, getSecret, Secrets } from 'utils';
import { UserActivationZambdaInput, UserActivationZambdaOutput } from 'utils/lib/types/api/user-activation.types';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';

export interface UserActivationZambdaInputValidated extends UserActivationZambdaInput {
  secrets: Secrets;
}

let oystehrToken: string;

export const index = wrapHandler('user-activation', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.group('validateRequestParameters');
  const validatedParameters = validateRequestParameters(input);
  const { userId, userActivationMode, secrets } = validatedParameters;
  console.groupEnd();
  console.debug('validateRequestParameters success');

  oystehrToken = await checkOrCreateM2MClientToken(oystehrToken, secrets);
  const PROJECT_API = getSecret('PROJECT_API', secrets);
  const oystehr = createOystehrClient(oystehrToken, secrets);
  const fetchClient = createFetchClientWithOystehrAuth({ authToken: oystehrToken });
  let user = await oystehr.user.get({ id: userId });
  console.log(
    `user before ${userActivationMode === 'activate' ? 'activating' : 'deactivating'}: `,
    JSON.stringify(user)
  );

  let response: UserActivationZambdaOutput = {};
  if (userActivationMode === 'activate') {
    response = await activateUser(user, fetchClient, PROJECT_API, oystehr);
  } else if (userActivationMode === 'deactivate') {
    response = await deactivateUser(user, fetchClient, PROJECT_API, oystehr);
  }

  user = await oystehr.user.get({ id: userId });
  console.log(
    `user after ${userActivationMode === 'activate' ? 'activating' : 'deactivating'}: `,
    JSON.stringify(user)
  );

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

async function deactivateUser(
  user: User,
  client: FetchClientWithOysterAuth,
  projectApi: string,
  oystehr: Oystehr
): Promise<UserActivationZambdaOutput> {
  // Deactivate Oystehr user by assigning Inactive role
  const userRoles = (user as any).roles;
  const userRoleIds = userRoles.map((role: any) => role.id);
  const userInactive = userRoles.find((role: any) => role.name === 'Inactive');
  if (!userInactive) {
    console.log('searching for Inactive role in the the project');
    let existingRoles;
    try {
      existingRoles = await client.oystehrFetch('GET', `${projectApi}/iam/role`);
    } catch (error) {
      console.error(error);
      throw new Error('Error searching for existing roles');
    }

    const inactiveRole = existingRoles.find((role: any) => role.name === 'Inactive');
    if (!inactiveRole) {
      throw new Error('Error searching for Inactive role');
    }

    // Order matters: flip Practitioner.active first. If the role patch fails
    // after this, the user is in the "less-bad" partial state — login may
    // still work but the practitioner is correctly hidden from booking flows
    // (the read-side check downstream uses Practitioner.active). The
    // operator can retry the deactivation call.
    await setPractitionerActive(user, false, oystehr);

    console.log('deactivating user');
    try {
      await client.oystehrFetch('PATCH', `${projectApi}/user/${user.id}`, {
        roles: [...userRoleIds, inactiveRole.id],
      });
    } catch (error) {
      console.error(error);
      throw new Error('Failed to deactivate user');
    }
  } else {
    // User already has Inactive role, but the Practitioner.active flag may
    // have drifted (e.g., this fix landed after a previous deactivation that
    // pre-dated Practitioner.active sync). Resync to keep the two in agreement.
    await setPractitionerActive(user, false, oystehr);
    return { message: 'User is already deactivated.' };
  }

  return { message: 'User successfully deactivated.' };
}

async function activateUser(
  user: User,
  client: FetchClientWithOysterAuth,
  projectApi: string,
  oystehr: Oystehr
): Promise<UserActivationZambdaOutput> {
  // Activating Oystehr user by removing Inactive role
  const userRoles = (user as any).roles;
  const userInactive = userRoles.find((role: any) => role.name === 'Inactive');
  if (userInactive) {
    const userRoleIds = userRoles.filter((role: any) => role.id !== userInactive.id).map((role: any) => role.id);

    console.log('activating user');
    try {
      await client.oystehrFetch('PATCH', `${projectApi}/user/${user.id}`, {
        roles: [...userRoleIds],
      });
    } catch (error) {
      console.error(error);
      throw new Error('Failed to activate user');
    }

    // Order matters: role removal first, then Practitioner.active=true. If
    // the practitioner patch fails after this, the user is in the "less-bad"
    // partial state — they can log in but their schedule stays hidden from
    // booking flows. Better than the inverse (visible in booking but unable
    // to log in to respond).
    await setPractitionerActive(user, true, oystehr);
  } else {
    // Already activated on the user/role side, but the Practitioner.active
    // flag may have drifted — see corresponding comment in deactivateUser.
    await setPractitionerActive(user, true, oystehr);
    return { message: 'User is already activated.' };
  }

  return { message: 'User successfully activated.' };
}

// Sync Practitioner.active with the user's activation state. Skips users
// without a Practitioner profile (e.g., self-registered patient profiles).
// Treats "Practitioner doesn't exist" as a silent skip — not every user has a
// FHIR Practitioner — but surfaces any other failure so the operator can retry.
async function setPractitionerActive(user: User, active: boolean, oystehr: Oystehr): Promise<void> {
  const profile = user.profile;
  if (!profile?.startsWith('Practitioner/')) {
    // Activating/deactivating a non-Practitioner user (e.g. a self-registered
    // Patient profile attached to an EHR user) shouldn't happen in normal
    // operator workflows. Don't throw — the role change is still meaningful
    // — but surface to Sentry so we can investigate if it appears in prod.
    const msg = `user-activation: user has no Practitioner profile; skipping Practitioner.active sync`;
    console.warn(msg, { userId: user.id, profile });
    captureMessage(msg, {
      level: 'warning',
      extra: { userId: user.id, profile, intendedActive: active },
    });
    return;
  }
  const practitionerId = profile.split('/')[1];
  if (!practitionerId) {
    const msg = `user-activation: malformed Practitioner profile reference; skipping .active sync`;
    console.warn(msg, { userId: user.id, profile });
    captureMessage(msg, {
      level: 'warning',
      extra: { userId: user.id, profile, intendedActive: active },
    });
    return;
  }
  try {
    await oystehr.fhir.patch({
      resourceType: 'Practitioner',
      id: practitionerId,
      // `add` rather than `replace` so it works whether or not the field
      // currently exists on the resource (per RFC 6902, `add` to an existing
      // path replaces it). Practitioners created before .active was tracked
      // would otherwise reject a `replace`.
      operations: [{ op: 'add', path: '/active', value: active }],
    });
    console.log(`Set Practitioner/${practitionerId}.active=${active}`);
  } catch (error: any) {
    const notFound = error?.issue?.some((i: any) => i?.severity === 'error' && i?.code === 'not-found');
    if (notFound) {
      // user.profile points at a Practitioner that no longer exists — likely
      // dangling reference from a deleted resource. Don't fail the activation,
      // but surface to Sentry as it suggests data drift worth investigating.
      const msg = `user-activation: referenced Practitioner not found; skipping .active sync`;
      console.warn(msg, { userId: user.id, practitionerId });
      captureMessage(msg, {
        level: 'warning',
        extra: { userId: user.id, practitionerId, intendedActive: active },
      });
      return;
    }
    console.error(`Failed to patch Practitioner/${practitionerId}.active=${active}`, error);
    throw new Error(
      `Failed to set Practitioner/${practitionerId}.active=${active}: ${error?.message ?? JSON.stringify(error)}`
    );
  }
}
