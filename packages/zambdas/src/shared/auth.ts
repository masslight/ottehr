import Oystehr, { User } from '@oystehr/sdk';
import { captureException } from '@sentry/aws-serverless';
import { Patient, RelatedPerson } from 'fhir/r4b';
import { decodeJwt } from 'jose';
import { getPatientsForUser } from 'utils/lib/auth/user-auth.helper';
import { TEST_USER_ID, userMe } from 'utils/lib/auth/user-me.helper';
import { getSecret, Secrets, SecretsKeys } from 'utils/lib/secrets';
import { RoleType } from 'utils/lib/types/api/user.types';
import { MISSING_AUTH_TOKEN, NOT_AUTHORIZED } from 'utils/lib/types/errors';
import { getAuth0Token } from './getAuth0Token';

/**
 * Authorization gate for role-restricted endpoints. Resolves the caller from a
 * Bearer `Authorization` header and returns true iff they hold at least one of
 * `allowedRoles`. Fails closed: a missing/blank header or any userMe failure
 * yields false, never a throw. This is the generalized form of
 * callerCanEditPaymentFields (which now delegates here).
 */
export async function callerHasRole(
  authorizationHeader: string | undefined,
  secrets: Secrets | null,
  allowedRoles: ReadonlyArray<string>
): Promise<boolean> {
  if (!authorizationHeader) return false;
  const token = authorizationHeader.replace(/^Bearer\s+/i, '');
  if (!token) return false;
  try {
    const caller = await userMe(token, secrets);
    const callerRoles = (caller.roles ?? []).map((role) => role.name);
    return callerRoles.some((role) => allowedRoles.includes(role));
  } catch (err) {
    console.error('Failed to resolve caller from Authorization header:', err);
    return false;
  }
}
export const getUserToken = (input: { headers?: { Authorization?: string } }): string => {
  const token = input.headers?.Authorization?.replace('Bearer ', '');
  if (!token) throw MISSING_AUTH_TOKEN;
  return token;
};

export async function getUser(token: string, secrets: Secrets | null): Promise<User> {
  let user: User;

  try {
    user = await userMe(token, secrets);
  } catch (error: any) {
    console.log('error getting user from token', error?.message || error);
    // 401/403 from user.me() is a client auth problem (revoked session / policy deny),
    // not an internal error — surface as a handled APIError instead of a 500.
    if (error instanceof Oystehr.OystehrSdkError && (error.code === 401 || error.code === 403)) {
      throw NOT_AUTHORIZED;
    }
    throw error;
  }

  return user;
}

export const requireUserWithRole = async (
  userToken: string,
  secrets: Secrets | null,
  allowedRoles: RoleType[]
): Promise<User> => {
  const user = await getUser(userToken, secrets);
  if (!user) throw NOT_AUTHORIZED;
  const hasAllowedRole = user.roles?.some((role) => allowedRoles.some((allowed) => role.name === allowed)) ?? false;
  if (!hasAllowedRole) throw NOT_AUTHORIZED;
  return user;
};

export const requireAdminUser = async (userToken: string, secrets: Secrets | null): Promise<void> => {
  await requireUserWithRole(userToken, secrets, [RoleType.Administrator]);
};

/**
 * Roles held by the Oystehr user behind the given Practitioner, or `undefined` when no user owns
 * that profile.
 *
 * Roles live in Oystehr, not in FHIR, so answering this takes two calls: `listV2` resolves the
 * Practitioner profile to a user id, and `get` is what actually returns the roles (`UserListItem`
 * from a list does not carry them).
 *
 * The `undefined` case is deliberately distinct from "holds no roles": a Practitioner can be the
 * profile of an M2M client rather than a user — see the M2M-as-user branch in `userMe` — so callers
 * gating on a role must decide for themselves whether an unresolvable profile is a denial. It
 * generally should not be: in production every employee is a user, so `undefined` means the caller
 * asked about something that is not an employee at all.
 */
export const getPractitionerRoles = async (oystehr: Oystehr, practitionerId: string): Promise<string[] | undefined> => {
  const { data } = await oystehr.user.listV2({ profile: `Practitioner/${practitionerId}`, limit: 1 });
  const userId = data[0]?.id;
  if (!userId) {
    return undefined;
  }
  const user = await oystehr.user.get({ id: userId });
  return (user.roles ?? []).map((role) => role.name);
};

export async function getPersonForPatient(patientID: string, oystehr: Oystehr): Promise<RelatedPerson | undefined> {
  const resources = (
    await oystehr.fhir.search<Patient | RelatedPerson>({
      resourceType: 'Patient',
      params: [
        {
          name: 'id',
          value: `Patient/${patientID}`,
        },
        {
          name: '_include',
          value: 'Patient:RelatedPerson',
        },
        {
          name: '_include',
          value: 'Person:RelatedPerson',
        },
      ],
    })
  ).unbundle();

  if (resources.length !== 0) {
    return undefined;
  }
  return resources[0] as RelatedPerson;
}

export type AuthType = 'regular';

// Re-mint the module-cached M2M token when it's within this window of expiry.
// Without this, a warm lambda (or a long-lived local server) keeps returning a
// token past its TTL and every downstream call starts failing with 401/500s.
const M2M_TOKEN_EXPIRY_MARGIN_MS = 5 * 60 * 1000;

type M2MTokenExpiryStatus = 'fresh' | 'near-expiry' | 'expired';

const getTokenExpiryStatus = (token: string): M2MTokenExpiryStatus => {
  try {
    const { exp } = decodeJwt(token);
    // No exp claim → treat as non-expiring (preserve warm-invocation reuse).
    if (typeof exp !== 'number') return 'fresh';
    const msUntilExpiry = exp * 1000 - Date.now();
    if (msUntilExpiry <= 0) return 'expired';
    if (msUntilExpiry < M2M_TOKEN_EXPIRY_MARGIN_MS) return 'near-expiry';
    return 'fresh';
  } catch {
    // Undecodable cached token — unusable, must be replaced.
    return 'expired';
  }
};

export async function checkOrCreateM2MClientToken(token: string, secrets: Secrets | null): Promise<string> {
  if (!token) {
    console.log('getting token');
    return await getAuth0Token(secrets);
  }
  const expiryStatus = getTokenExpiryStatus(token);
  if (expiryStatus === 'fresh') {
    console.log('already have token');
    return token;
  }
  if (expiryStatus === 'near-expiry') {
    // Proactive refresh: the cached token is still valid for a few more minutes, so a failed
    // re-mint must not fail the request — fall back to the cached token and let a later
    // invocation retry the refresh.
    console.log('cached token near expiry - attempting to get new token');
    try {
      return await getAuth0Token(secrets);
    } catch (error) {
      console.error('failed to refresh near-expiry M2M token, falling back to still-valid cached token', error);
      captureException(error);
      return token;
    }
  }
  // Expired (or undecodable) — the cached token is unusable, so a re-mint failure must propagate.
  console.log('cached token expired - getting new token');
  return await getAuth0Token(secrets);
}

export const isTestM2MClient = (token: string, secrets: Secrets | null): boolean => {
  const decoded = decodeJwt(token);

  if (!decoded) {
    return false;
  }

  const testM2MClientId = getSecret(SecretsKeys.AUTH0_CLIENT, secrets);
  return testM2MClientId === (decoded as any).sub?.split('@')?.[0];
};

export const isTestUser = (user: User): boolean => {
  return user && user.id === TEST_USER_ID;
};

export const checkIsEHRUser = (user: User | undefined): boolean => {
  return !!user && !user?.name?.startsWith?.('+') && !isTestUser(user);
};

export async function userHasAccessToPatient(user: User, patientID: string, oystehr: Oystehr): Promise<boolean> {
  if (!user) {
    return false;
  }

  // todo: change this to use check user is ehr user utility once branch defining it is merged
  const isEHRUser = checkIsEHRUser(user);
  if (isEHRUser) {
    // for now, if the user is an EHR user, they have access to all patients by default
    return true;
  }
  // Get all of the patients the user has access to,
  // get the ID for each patient,
  // check any of those patients match the patientID parameter,
  // if so return true otherwise return false
  return (await getPatientsForUser(user, oystehr)).some((patientTemp) => patientTemp.id === patientID);
}
