import Oystehr, { User } from '@oystehr/sdk';
import { captureException, captureMessage } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import { createFetchClientWithOystehrAuth, FetchClientWithOysterAuth } from 'utils/lib/helpers/helpers';
import { getSecret, Secrets } from 'utils/lib/secrets';
import {
  ErxUnenrollmentOutcome,
  UserActivationZambdaInput,
  UserActivationZambdaOutput,
} from 'utils/lib/types/api/user-activation.types';
import { ZambdaInput } from '../../shared/types/common';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
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
  const oystehr = createClinicalOystehrClient(oystehrToken, secrets);
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
  let alreadyDeactivated = false;
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
    alreadyDeactivated = true;
  }

  // Runs on the already-deactivated path too, so re-running deactivate retries an
  // unenrollment that failed (or never ran, for users deactivated before this landed).
  const erxUnenrollment = await unenrollPractitionerFromErx(user, oystehr);

  return {
    message: alreadyDeactivated ? 'User is already deactivated.' : 'User successfully deactivated.',
    erxUnenrollment,
  };
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

// A project that doesn't have eRx set up answers every eRx call with this error. That's the
// expected state on most lower envs, so it's a no-op rather than a failure worth reporting.
// Matched on message rather than code ('4006' covers a broad family of eRx input errors —
// see getErxPatientSyncErrorMessage in apps/ehr, which special-cases the same string).
function isErxNotConfiguredError(error: any): boolean {
  return typeof error?.message === 'string' && error.message.toLowerCase().includes('erx service is not configured');
}

// eRx enrollment lives with the upstream eRx provider (DoseSpot), keyed by Practitioner id —
// flipping the Oystehr user to Inactive doesn't touch it, so a departed clinician would otherwise
// keep a live prescriber account there. Unenroll them as part of deactivation.
//
// Never throws: by the time this runs the deactivation itself has already landed (Inactive role +
// Practitioner.active=false), and rejecting here would report an otherwise-successful deactivation
// as a failure to the operator. Failures are logged, sent to Sentry, and returned in the response;
// re-running deactivate retries the unenrollment.
//
// Activation deliberately does NOT re-enroll: the eRx module enrolls the practitioner on demand the
// next time they open eRx (see the enrollment effect in apps/ehr .../shared/components/ERX.tsx), so
// a reactivated user gets a fresh enrollment with no operator step.
async function unenrollPractitionerFromErx(user: User, oystehr: Oystehr): Promise<ErxUnenrollmentOutcome> {
  const profile = user.profile;
  // No Sentry report here — setPractitionerActive already flagged this same condition
  // earlier in the call, and a second event would just be duplicate noise.
  if (!profile?.startsWith('Practitioner/')) {
    console.log('user has no Practitioner profile; skipping eRx unenrollment', { userId: user.id, profile });
    return 'no-practitioner';
  }
  const practitionerId = profile.split('/')[1];
  if (!practitionerId) {
    console.log('malformed Practitioner profile reference; skipping eRx unenrollment', { userId: user.id, profile });
    return 'no-practitioner';
  }

  // Each eRx call is caught separately so the log names the call that actually failed — the two
  // need different grants on the zambdas M2M client (eRx:Read vs eRx:Delete on eRx:Enrollment),
  // and a shared catch reported every failure as "failed to unenroll", pointing at the wrong one.
  const onFailure = (
    error: any,
    operation: 'checkPractitionerEnrollment' | 'unenrollPractitioner'
  ): 'not-configured' | 'failed' => {
    if (isErxNotConfiguredError(error)) {
      console.log(`eRx is not configured for this project; skipping unenrollment of Practitioner/${practitionerId}`);
      return 'not-configured';
    }
    // OystehrSdkError carries the HTTP status on `code`; log it, since a 403 here means the M2M
    // client is missing an eRx:Enrollment grant rather than anything being wrong with the user.
    console.error(
      `eRx ${operation} failed for Practitioner/${practitionerId} (status ${error?.code ?? 'unknown'})`,
      error
    );
    captureException(error, {
      level: 'error',
      tags: { system: 'erx', zambda: 'user-activation' },
      extra: { userId: user.id, practitionerId, operation, status: error?.code },
    });
    return 'failed';
  };

  // Enrollment is checked first so the common case — staff who never touched eRx — doesn't hit
  // the vendor with an unenroll for an account that was never registered.
  let enrollment;
  try {
    enrollment = await oystehr.erx.checkPractitionerEnrollment({ practitionerId });
  } catch (error: any) {
    return onFailure(error, 'checkPractitionerEnrollment');
  }

  if (!enrollment.registered) {
    console.log(`Practitioner/${practitionerId} is not enrolled in eRx; nothing to unenroll`);
    return 'not-enrolled';
  }

  try {
    await oystehr.erx.unenrollPractitioner({ practitionerId });
  } catch (error: any) {
    return onFailure(error, 'unenrollPractitioner');
  }

  console.log(`Unenrolled Practitioner/${practitionerId} from eRx`);
  return 'unenrolled';
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
