import Oystehr, { UserInviteParams } from '@oystehr/sdk';
import { Practitioner } from 'fhir/r4b';
import { randomUUID } from 'node:crypto';
import {
  allLicensesForPractitioner,
  getFirstName,
  getLastName,
  getMiddleName,
  getPractitionerNPI,
  getSuffix,
  makeQualificationForPractitioner,
  PractitionerLicense,
  RoleType,
} from '../temp-imports-from-utils';

export interface TestEmployeeInviteParams {
  userName?: string;
  email?: string;
  givenName: string;
  middleName: string;
  familyName: string;
  telecomPhone: string;
  npi: string;
  credentials: string;
  roles: RoleType[];
  qualification: PractitionerLicense[];
}

export interface TestEmployee extends TestEmployeeInviteParams {
  id: string;
  userName: string;
  email: string;
  phoneNumber: string;
  authenticationMethod: string;
  profile: Practitioner;
}

export type UserResponse = {
  id: string;
  name: string;
  email: string;
  phoneNumber: string;
  authenticationMethod: string;
  profile: Practitioner;
  roles: {
    id: string;
    name: string;
  }[];
};

const testEmployeeUsernamePattern = 'e2e-employee-';

export const TEST_EMPLOYEE_1: TestEmployeeInviteParams = {
  givenName: 'employeesTest1',
  middleName: 'middle',
  familyName: 'ottehr-ehr-e2e',
  telecomPhone: '0734324300',
  npi: '1111111111',
  credentials: 'credentials',
  roles: [RoleType.Provider],
  qualification: [
    {
      code: 'CISW',
      state: 'AR',
      active: true,
    },
    {
      code: 'PHARMACY-ASSISTA',
      state: 'AK',
      active: true,
    },
  ],
};

export const TEST_EMPLOYEE_1_UPDATED_INFO: TestEmployeeInviteParams = {
  givenName: 'new employeesTest1',
  middleName: 'new middle',
  familyName: 'new ottehr-ehr-e2e',
  telecomPhone: '0734324301',
  credentials: 'new credentials',
  npi: '2222222222',
  roles: [RoleType.Provider, RoleType.Staff],
  qualification: [
    {
      code: 'CISW',
      state: 'AR',
      active: true,
    },
    {
      code: 'PHARMACY-ASSISTA',
      state: 'AK',
      active: true,
    },
    {
      code: 'CMSW',
      state: 'CA',
      active: true,
    },
  ],
};

export const TEST_EMPLOYEE_2: TestEmployeeInviteParams = {
  givenName: 'employeesTest2',
  middleName: 'middle2',
  familyName: 'ottehr-ehr-e2e',
  telecomPhone: '0734324300',
  npi: '1111111111',
  credentials: 'credentials',
  roles: [RoleType.Provider],
  qualification: [
    {
      code: 'PODIATRIC-ASSIST',
      state: 'AK',
      active: true,
    },
  ],
};

export function invitationParamsForEmployee(employee: TestEmployeeInviteParams, roles: string[]): UserInviteParams {
  if (!process.env.EHR_APPLICATION_ID) throw new Error('EHR_APPLICATION_ID is not set');
  const uuid = randomUUID();

  return {
    username: employee.userName ?? `${testEmployeeUsernamePattern}${uuid}`,
    email: employee.email ?? `e2e-employee-${uuid}@gmail.com`,
    applicationId: process.env.EHR_APPLICATION_ID,
    roles,
    resource: {
      identifier: [
        {
          value: employee.npi,
          system: 'http://hl7.org/fhir/sid/us-npi',
        },
      ],
      resourceType: 'Practitioner',
      active: true,
      name: [
        {
          family: employee.familyName,
          given: [employee.givenName, employee.middleName],
          suffix: [employee.credentials],
        },
      ],
      telecom: [
        {
          system: 'email',
          value: employee.email,
        },
        {
          value: employee.telecomPhone,
          system: 'sms',
        },
      ],
      qualification: employee.qualification.map((qualification) => makeQualificationForPractitioner(qualification)),
    },
  };
}

async function fetchWithOystAuth(
  url: string,
  method: string,
  authToken: string,
  body?: any
): Promise<Response | undefined> {
  const oyst_proj_id = process.env.PROJECT_ID;
  if (!oyst_proj_id) throw new Error('secret PROJECT_ID is not set');

  const response = await fetch(url, {
    method,
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      authorization: `Bearer ${authToken}`,
      'x-zapehr-project-id': oyst_proj_id,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const res = await response.json();
    console.error(`HTTP error for ${url}: ${res}, ${JSON.stringify(res)}`);
    return undefined;
  }
  console.log(`Request status for ${url}: `, response.status);
  return response;
}

export async function inviteTestEmployeeUser(
  employee: TestEmployeeInviteParams,
  oystehr: Oystehr,
  authToken: string
): Promise<TestEmployee | undefined> {
  const rolesResponse = await fetchWithOystAuth('https://project-api.zapehr.com/v1/iam/role', 'GET', authToken);
  const rolesRaw = (await rolesResponse?.json()) as { id: string; name: string }[];
  const providerRoleId = rolesRaw.find((role) => role.name === RoleType.Provider)?.id;
  if (!providerRoleId) throw new Error(`Didn't found any role with name: ${RoleType.Provider}`);
  const response = await fetchWithOystAuth(
    'https://project-api.zapehr.com/v1/user/invite',
    'POST',
    authToken,
    invitationParamsForEmployee(employee, [providerRoleId])
  );
  const res = await response?.json();
  if (res) {
    const { id, name, email, profile, phoneNumber, authenticationMethod, roles } = res;
    const practitioner = await oystehr.fhir.get<Practitioner>({
      resourceType: 'Practitioner',
      id: (profile as string).replace('Practitioner/', ''),
    });
    return parseTestUser({
      id,
      name,
      email,
      profile: practitioner,
      phoneNumber,
      authenticationMethod,
      roles,
    });
  }
  throw new Error('New user were not invited');
}

export async function removeUser(
  userId: string,
  practitionerId: string,
  oystehr: Oystehr,
  authToken: string
): Promise<void> {
  const removeUser = fetchWithOystAuth(`https://project-api.zapehr.com/v1/user/${userId}`, 'DELETE', authToken);
  const removeUserPractitioner = oystehr.fhir.delete({ resourceType: 'Practitioner', id: practitionerId });
  const [removedUser] = await Promise.all([removeUser, removeUserPractitioner]);

  if (removedUser?.status && removedUser.status !== 204) {
    const res = await removedUser?.json();
    console.error(`HTTP error: ${res}, ${JSON.stringify(res)}`);
  } else {
    console.log(`✅ employee deleted ${userId}`);
    console.log(`✅ practitioner for employee deleted ${practitionerId}`);
  }
}

export async function tryToFindAndRemoveTestUsers(oystehr: Oystehr, authToken: string): Promise<void> {
  const response = await fetchWithOystAuth('https://project-api.zapehr.com/v1/user', 'GET', authToken);

  const res = await response?.json();
  if (!res) return;
  const users = res as { id: string; name: string; profile: string }[];
  const usersToDelete = users.filter((user) => user.name.includes(testEmployeeUsernamePattern));

  await Promise.all(
    usersToDelete.map((user) => removeUser(user.id, user.profile.replace('Practitioner/', ''), oystehr, authToken))
  );
}

function parseTestUser(user: UserResponse): TestEmployee {
  const firstName = getFirstName(user.profile);
  const middleName = getMiddleName(user.profile);
  const lastName = getLastName(user.profile);
  if (!firstName || !middleName || !lastName) throw new Error(`Error parsing user full name: ${user.id}`);
  const phone = user.profile.telecom?.find((telecom) => telecom.system === 'sms')?.value;
  const npi = getPractitionerNPI(user.profile);
  const qualification = allLicensesForPractitioner(user.profile);
  const credentials = getSuffix(user.profile);
  if (!phone) throw new Error(`No phone for this user: ${user.id}`);
  if (!npi) throw new Error(`No npi for this user: ${user.id}`);
  if (!credentials) throw new Error(`No credentials for this user: ${user.id}`);
  return {
    id: user.id,
    userName: user.name,
    email: user.email,
    phoneNumber: user.phoneNumber,
    authenticationMethod: user.authenticationMethod,
    profile: user.profile,
    givenName: firstName,
    middleName: middleName,
    familyName: lastName,
    telecomPhone: phone,
    npi,
    credentials,
    roles: user.roles.map((role) => role.name) as RoleType[],
    qualification,
  };
}
