import Oystehr, { RoleListItem, UserListItem } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Practitioner } from 'fhir/r4b';
import { allLicensesForPractitioner, getResourcesFromBatchInlineRequests } from 'utils/lib/fhir/helpers';
import { getFirstName, getLastName, getProviderNotificationPreferencesV2 } from 'utils/lib/fhir/patient';
import { getIdFromReference } from 'utils/lib/fhir/reference';
import { standardizePhoneNumber } from 'utils/lib/helpers/helpers';
import { EmployeeDetails, GetEmployeesResponse } from 'utils/lib/types/api/get-employees/get-employees.types';
import { getAllNotificationRows } from 'utils/lib/types/api/provider-notifications';
import { AVAILABLE_EMPLOYEE_ROLES, hasPractitionerProfile, RoleType } from 'utils/lib/types/api/user.types';
import { getAuth0Token } from '../../shared/getAuth0Token';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { lambdaResponse } from '../../shared/lambda';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { getRoleMembers } from '../../shared/users.helper';

// For local development it makes it easier to track performance
if (process.env.IS_OFFLINE === 'true') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('console-stamp')(console, { pattern: 'HH:MM:ss.l' });
}

let oystehrToken: string;
export const index = wrapHandler('get-employees', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { secrets } = input;

  if (!oystehrToken) {
    console.log('getting token');
    oystehrToken = await getAuth0Token(secrets);
  } else {
    console.log('already have token');
  }

  const oystehr = createClinicalOystehrClient(oystehrToken, secrets);

  const promises: [Promise<UserListItem[]>, Promise<RoleListItem[]>] = [getEmployees(oystehr), getRoles(oystehr)];
  const [allEmployees, existingRoles] = await Promise.all(promises);

  console.log(`Fetched ${allEmployees.length} employees and ${existingRoles.length} roles.`);

  const inactiveRoleId = existingRoles.find((role) => role.name === RoleType.Inactive)?.id;
  if (!inactiveRoleId) {
    throw new Error('Error searching for the Inactive role.');
  }

  // Every assignable role, so callers can filter and display roles directly rather than working from
  // a handful of derived booleans. A project that hasn't provisioned one of these roles yet simply
  // has no members for it, which is not an error — only Inactive is required, since `status` needs it.
  const assignableRoles = AVAILABLE_EMPLOYEE_ROLES.map(({ value }) => ({
    role: value,
    id: existingRoles.find((role) => role.name === value)?.id,
  })).filter((entry): entry is { role: RoleType; id: string } => Boolean(entry.id));

  const practitionerIds = allEmployees
    .filter((employee) => employee.profile?.startsWith('Practitioner/'))
    .map((employee) => getIdFromReference(employee.profile, 'Practitioner'));

  const getPractitionersRequest = getResourcesFromBatchInlineRequests(oystehr, [
    `Practitioner?_id=${practitionerIds.join(',')}&_elements=id,meta,qualification,name,extension,telecom`,
  ]);

  console.log('Do mixed promises in parallel...');

  const [inactiveRoleMembers, assignableRoleMembers, practitioners] = await Promise.all([
    getRoleMembers(inactiveRoleId, oystehr),
    Promise.all(assignableRoles.map(async ({ role, id }) => ({ role, members: await getRoleMembers(id, oystehr) }))),
    getPractitionersRequest as Promise<Practitioner[]>,
  ]);

  const inactiveMemberIds = new Set(inactiveRoleMembers.map((member) => member.id));

  // userId -> roles held. Built once so the per-employee mapping below stays a lookup rather than a
  // scan of every role's membership list.
  const rolesByUserId = new Map<string, RoleType[]>();
  for (const { role, members } of assignableRoleMembers) {
    for (const member of members) {
      const existing = rolesByUserId.get(member.id);
      if (existing) existing.push(role);
      else rolesByUserId.set(member.id, [role]);
    }
  }

  const employeeDetails: EmployeeDetails[] = allEmployees.map((employee) => {
    const status = inactiveMemberIds.has(employee.id) ? 'Deactivated' : 'Active';
    const isPractitioner = hasPractitionerProfile(employee.profile);
    const practitionerId = isPractitioner ? getIdFromReference(employee.profile) : undefined;
    const practitioner = practitionerId ? practitioners.find((resource) => resource.id === practitionerId) : undefined;

    const phone = practitioner?.telecom?.find((telecom) => telecom.system === 'sms')?.value;

    const notificationPreferences = getProviderNotificationPreferencesV2(practitioner);
    return {
      id: employee.id,
      profile: employee.profile,
      name: employee.name,
      email: employee.email,
      status: status,
      roles: rolesByUserId.get(employee.id) ?? [],
      lastLogin: practitioner?.meta?.tag?.find((tag) => tag.system === 'last-login')?.code ?? '',
      firstName: getFirstName(practitioner) ?? '',
      lastName: getLastName(practitioner) ?? '',
      phoneNumber: phone ? standardizePhoneNumber(phone)! : '',
      licenses: practitioner ? allLicensesForPractitioner(practitioner) : [],
      gettingAlerts: notificationPreferences
        ? getAllNotificationRows(notificationPreferences).some((row) => row.enabled)
        : false,
      needsReview: !isPractitioner,
    };
  });

  const response: GetEmployeesResponse = {
    message: `Successfully retrieved employee details`,
    employees: employeeDetails,
  };

  return lambdaResponse(200, response);
});

async function getEmployees(oystehr: Oystehr): Promise<UserListItem[]> {
  // Include email-based users even when they have no Practitioner profile
  // (e.g. self-signup users stuck on the Patient role), so admins can reclassify them.
  const allEmployees = (await oystehr.user.list()).filter((user) => !user.name.startsWith('+'));
  return allEmployees;
}

async function getRoles(oystehr: Oystehr): Promise<RoleListItem[]> {
  return oystehr.role.list();
}
