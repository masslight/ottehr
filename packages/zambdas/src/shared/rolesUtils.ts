import { AccessPolicy, RoleType } from 'utils';
import {
  ADMINISTRATOR_RULES,
  CUSTOMER_SUPPORT_RULES,
  FRONT_DESK_RULES,
  INACTIVE_RULES,
  MANAGER_RULES,
  PRESCRIBER_RULES,
  PROVIDER_RULES,
  STAFF_RULES,
} from '../shared/';

export async function getRoleId(roleName: string, token: string, projectApiUrl: string): Promise<string> {
  const headers = {
    accept: 'application/json',
    'content-type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  const existingRolesResponse = await fetch(`${projectApiUrl}/iam/role`, {
    method: 'GET',
    headers: headers,
  });
  const existingRoles = await existingRolesResponse.json();
  const roleId = existingRoles.find((existingRole: any) => existingRole.name === roleName)?.id;

  if (!roleId) {
    throw new Error('Role not found');
  }

  return roleId;
}

interface Role {
  name: string;
  accessPolicy: AccessPolicy;
}

export const allNonPatientRoles: Role[] = [
  { name: RoleType.Administrator, accessPolicy: ADMINISTRATOR_RULES },
  { name: RoleType.CustomerSupport, accessPolicy: CUSTOMER_SUPPORT_RULES },
  { name: RoleType.FrontDesk, accessPolicy: FRONT_DESK_RULES },
  { name: RoleType.Inactive, accessPolicy: INACTIVE_RULES },
  { name: RoleType.Manager, accessPolicy: MANAGER_RULES },
  { name: RoleType.Prescriber, accessPolicy: PRESCRIBER_RULES },
  { name: RoleType.Provider, accessPolicy: PROVIDER_RULES },
  { name: RoleType.Staff, accessPolicy: STAFF_RULES },
];
