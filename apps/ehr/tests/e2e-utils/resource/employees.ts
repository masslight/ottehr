// cSpell:ignore ASSISTA, CISW, CMSW
import { randomUUID } from 'node:crypto';
import Oystehr, { UserInviteParams } from '@oystehr/sdk';
import { Practitioner } from 'fhir/r4b';
import {
  allLicensesForPractitioner,
  getFirstName,
  getLastName,
  getMiddleName,
  getPractitionerNPIIdentifier,
  getSuffix,
  makeQualificationForPractitioner,
  PractitionerLicense,
  RoleType,
} from 'utils';
import { fetchWithOystehrAuth } from '../helpers/tests-utils';

export interface TestEmployeeInviteParams {
  userName?: string;
  email?: string;
  givenName: string;
  middleName: string;
  familyName?: string;
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
  familyName: string;
  phoneNumber: string;
  authenticationMethod: string;
  profile: Practitioner;
}

type UserResponse = {
  id: string;
  name: string;
  email: string;
  phoneNumber: string;
  authenticationMethod: string;
  profile: string;
  roles: {
    id: string;
    name: string;
  }[];
};

const testEmployeeUsernamePattern = 'e2e-employee-';
export const testEmployeeGivenNamePattern = 'employeeTestE2E';

export const TEST_EMPLOYEE_1: TestEmployeeInviteParams = {
  givenName: `${testEmployeeGivenNamePattern}1`,
  middleName: 'middle',
  telecomPhone: '0734324300',
  npi: '1111111111',
  credentials: 'credentials',
  roles: [RoleType.Provider],
  qualification: [
    {
      code: 'CISW',
      state: 'AR',
      number: '12345',
      date: '2026-04-23',
      active: true,
    },
    {
      code: 'PHARMACY-ASSISTA',
      state: 'AK',
      number: '54321',
      date: '2026-04-23',
      active: true,
    },
  ],
};

export const TEST_EMPLOYEE_1_UPDATED_INFO: TestEmployeeInviteParams = {
  givenName: `new ${testEmployeeGivenNamePattern}`,
  middleName: 'new middle',
  telecomPhone: '0734324301',
  credentials: 'new credentials',
  npi: '2222222222',
  roles: [RoleType.Provider, RoleType.Staff],
  qualification: [
    {
      code: 'CISW',
      state: 'AR',
      number: '12345',
      date: '2026-04-23',
      active: true,
    },
    {
      code: 'PHARMACY-ASSISTA',
      state: 'AK',
      number: '54321',
      date: '2026-04-23',
      active: true,
    },
    {
      code: 'CMSW',
      state: 'CA',
      number: '15243',
      date: '2026-04-23',
      active: true,
    },
  ],
};

export const TEST_EMPLOYEE_2: TestEmployeeInviteParams = {
  givenName: `${testEmployeeGivenNamePattern}2`,
  middleName: 'middle2',
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
  const uniqueLastName = randomUUID();

  return {
    username: employee.userName ?? `${testEmployeeUsernamePattern}${uuid}`,
    email: employee.email ?? `e2e-tests+${uuid}@ottehr.com`,
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
          family: employee.familyName ?? uniqueLastName,
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

export async function inviteTestEmployeeUser(
  employee: TestEmployeeInviteParams,
  oystehr: Oystehr,
  authToken: string
): Promise<TestEmployee | undefined> {
  const rolesRaw = await fetchWithOystehrAuth<{ id: string; name: string }[]>(
    'GET',
    'https://project-api.zapehr.com/v1/iam/role',
    authToken
  );
  const providerRoleId = rolesRaw.find((role) => role.name === RoleType.Provider)?.id;
  if (!providerRoleId) throw new Error(`Didn't found any role with name: ${RoleType.Provider}`);
  const response = await fetchWithOystehrAuth<UserResponse>(
    'POST',
    'https://project-api.zapehr.com/v1/user/invite',
    authToken,
    invitationParamsForEmployee(employee, [providerRoleId])
  );
  return await parseTestUser(response, oystehr);
}

export async function removeUser(
  userId: string,
  practitionerId: string,
  oystehr: Oystehr,
  authToken: string
): Promise<void> {
  const removeUser = fetchWithOystehrAuth('DELETE', `https://project-api.zapehr.com/v1/user/${userId}`, authToken);
  const removeUserPractitioner = oystehr.fhir.delete({ resourceType: 'Practitioner', id: practitionerId });
  await Promise.all([removeUser, removeUserPractitioner]);

  console.log(`✅ employee deleted ${userId}`);
  console.log(`✅ practitioner for employee deleted ${practitionerId}`);
}

async function parseTestUser(user: UserResponse, oystehr: Oystehr): Promise<TestEmployee> {
  const practitioner = await oystehr.fhir.get<Practitioner>({
    resourceType: 'Practitioner',
    id: user.profile.replace('Practitioner/', ''),
  });

  const firstName = getFirstName(practitioner);
  const middleName = getMiddleName(practitioner);
  const lastName = getLastName(practitioner);
  if (!firstName || !middleName || !lastName) throw new Error(`Error parsing user full name: ${user.id}`);
  const phone = practitioner.telecom?.find((telecom) => telecom.system === 'sms')?.value;
  const npi = getPractitionerNPIIdentifier(practitioner)?.value;
  const qualification = allLicensesForPractitioner(practitioner);
  const credentials = getSuffix(practitioner);
  if (!phone) throw new Error(`No phone for this user: ${user.id}`);
  if (!npi) throw new Error(`No npi for this user: ${user.id}`);
  if (!credentials) throw new Error(`No credentials for this user: ${user.id}`);
  return {
    id: user.id,
    userName: user.name,
    email: user.email,
    phoneNumber: user.phoneNumber,
    authenticationMethod: user.authenticationMethod,
    profile: practitioner,
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
