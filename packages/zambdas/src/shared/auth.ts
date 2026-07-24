import Oystehr, { User } from '@oystehr/sdk';
import { Patient, Practitioner, RelatedPerson } from 'fhir/r4b';
import { decodeJwt } from 'jose';
import {
  getNPIIdentifier,
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
 * Throws NOT_AUTHORIZED unless the given Practitioner has an NPI identifier.
 *
 * NPI-gated actions (signing/co-signing notes, e-prescribing, ordering external labs & imaging,
 * submitting claims under a provider NPI, and ordering in-house medications) must be performed
 * only by a user whose Practitioner carries an NPI. The clinical zambdas run their FHIR writes
 * under an M2M token, so the caller's Oystehr access policy does not gate them — this check is the
 * backend enforcement point that blocks non-NPI roles such as Clinician from reaching these actions
 * via a direct API call.
 */
export const assertPractitionerHasNPI = (practitioner: Practitioner): void => {
  if (!getNPIIdentifier(practitioner)?.value) {
    throw NOT_AUTHORIZED;
  }
};

/** Reads the Practitioner and asserts it has an NPI. See {@link assertPractitionerHasNPI}. */
export const requirePractitionerNPI = async (oystehr: Oystehr, practitionerId: string): Promise<Practitioner> => {
  const practitioner = await oystehr.fhir.get<Practitioner>({ resourceType: 'Practitioner', id: practitionerId });
  assertPractitionerHasNPI(practitioner);
  return practitioner;
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

export async function checkOrCreateM2MClientToken(token: string, secrets: Secrets | null): Promise<string> {
  if (!token) {
    console.log('getting token');
    return await getAuth0Token(secrets);
  } else {
    console.log('already have token');
    return token;
  }
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
