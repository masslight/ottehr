import Oystehr, { User } from '@oystehr/sdk';
import { Patient, RelatedPerson } from 'fhir/r4b';
import { decodeJwt } from 'jose';
import {
  getPatientsForUser,
  getSecret,
  NOT_AUTHORIZED,
  RoleType,
  Secrets,
  SecretsKeys,
  TEST_USER_ID,
  userMe,
} from 'utils';
import { getAuth0Token } from './getAuth0Token';
import { ZambdaInput } from './types/common';

// The caller's bearer token, or NOT_AUTHORIZED (a handled 401) when there isn't one.
//
// The `input.headers.Authorization.replace('Bearer ', '')` line this replaces is copy-pasted at ~118
// sites, inconsistently: the versions without `?.` throw a TypeError — a 500 — when the header is
// simply absent, and none of them reject a header that is present but blank. New code should use
// this; existing sites can converge on it as they're touched.
export function getUserToken(input: Pick<ZambdaInput, 'headers'>): string {
  const authorization = input.headers?.Authorization ?? input.headers?.authorization;
  if (typeof authorization !== 'string') {
    throw NOT_AUTHORIZED;
  }
  const token = authorization.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    throw NOT_AUTHORIZED;
  }
  return token;
}

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

// True when the cached JWT is missing, unparseable, has no exp, or is within `skewSeconds` of
// expiring. We refresh inside that window rather than at the hard expiry so a request never goes
// out with a just-expired token.
function isM2MTokenExpiringSoon(token: string, skewSeconds = 60): boolean {
  try {
    const exp = decodeJwt(token).exp;
    if (typeof exp !== 'number') return true;
    return Date.now() / 1000 >= exp - skewSeconds;
  } catch {
    return true;
  }
}

export async function checkOrCreateM2MClientToken(token: string, secrets: Secrets | null): Promise<string> {
  // The token is cached in module scope across warm invocations. Refresh when it's missing OR
  // expired/near-expiry — without the expiry check a long-running process (e.g. the local dev
  // server) keeps reusing a stale token and every authed FHIR call 500s until the process restarts.
  if (!token || isM2MTokenExpiringSoon(token)) {
    console.log('getting token');
    return await getAuth0Token(secrets);
  }
  console.log('already have token');
  return token;
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
