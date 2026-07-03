import Oystehr, { User } from '@oystehr/sdk';
import { captureException } from '@sentry/aws-serverless';
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
): Promise<void> => {
  const user = await getUser(userToken, secrets);
  if (!user) throw NOT_AUTHORIZED;
  const roles = (user as any).roles as { name?: string }[] | undefined;
  const hasAllowedRole = roles?.some((role) => allowedRoles.some((allowed) => role.name === allowed)) ?? false;
  if (!hasAllowedRole) throw NOT_AUTHORIZED;
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
