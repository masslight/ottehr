import Oystehr, { Role, RoleListItem } from '@oystehr/sdk';
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

export const allNonPatientRoles = [
  { name: RoleType.Administrator, accessPolicy: ADMINISTRATOR_RULES },
  { name: RoleType.CustomerSupport, accessPolicy: CUSTOMER_SUPPORT_RULES },
  { name: RoleType.FrontDesk, accessPolicy: FRONT_DESK_RULES },
  { name: RoleType.Inactive, accessPolicy: INACTIVE_RULES },
  { name: RoleType.Manager, accessPolicy: MANAGER_RULES },
  { name: RoleType.Prescriber, accessPolicy: PRESCRIBER_RULES },
  { name: RoleType.Provider, accessPolicy: PROVIDER_RULES },
  { name: RoleType.Staff, accessPolicy: STAFF_RULES },
];

type UpdateUserRolesReturnType = { [key in RoleType]?: string | undefined };
export const updateUserRoles = async (oystehr: Oystehr): Promise<UpdateUserRolesReturnType> => {
  console.log('Updating user roles.');

  console.log('searching for existing roles for the project');
  let existingRoles: RoleListItem[];
  try {
    existingRoles = await oystehr.role.list();
  } catch {
    throw new Error('Error searching for existing roles');
  }
  console.log('existingRoles: ', existingRoles);

  const allRoles = allNonPatientRoles.map((role) => ({ [role.name]: undefined })) as UpdateUserRolesReturnType;

  for (const role of allNonPatientRoles) {
    const roleName = role.name;
    let foundRole;
    if (existingRoles.length > 0) {
      foundRole = existingRoles.find((existingRole: any) => existingRole.name === roleName);
    }
    let roleResult: Role;
    if (foundRole) {
      console.log(`${roleName} role found: `, foundRole);
      try {
        roleResult = await oystehr.role.update({
          roleId: foundRole.id,
          accessPolicy: role.accessPolicy as AccessPolicy,
        });
        console.log(`${roleName} role accessPolicy patched: `, roleResult, JSON.stringify(roleResult.accessPolicy));
      } catch (err) {
        console.error(err);
        throw new Error(`Failed to patch role ${roleName}`);
      }
    } else {
      console.log(`creating ${roleName} role`);
      try {
        roleResult = await oystehr.role.create({ name: roleName, accessPolicy: role.accessPolicy as AccessPolicy });
        console.log(`${roleName} role: `, roleResult, JSON.stringify(roleResult.accessPolicy));
      } catch (err) {
        console.error(err);
        throw new Error(`Failed to create role ${roleName}`);
      }
    }

    allRoles[roleResult.name as RoleType] = roleResult.id;
  }

  return allRoles;
};

export const filterIdsOnlyToTheseRoles = (roles: UpdateUserRolesReturnType, allowedRoles: RoleType[]): string[] => {
  return Object.entries(roles)
    .map(([roleName, id]) => {
      if (id && allowedRoles.includes(roleName as RoleType)) {
        return id;
      }
      return undefined;
    })
    .filter((roleId) => roleId !== undefined);
};
