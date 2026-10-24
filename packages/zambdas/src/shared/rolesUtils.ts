import Oystehr, { Role, RoleListItem } from '@oystehr/sdk';
import { AccessPolicy, RoleType } from 'utils/lib/types/api/user.types';
import rolesSpec from '../../../../config/oystehr-core/roles.json';

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

/**
 * The staff-side roles exactly as declared in config/oystehr-core/roles.json — the one source of truth that
 * Terraform applies, and whose Zambda:InvokeFunction grants are generated from the `access` declared on each
 * zambda (`npm run zambda-access:generate`). The scripts that create or patch roles through the API
 * (update-user-roles, invite-user) read this list so they can never push a policy that differs from the IaC
 * config. The Patient role is provisioned with the project and is deliberately left out.
 */
export const allNonPatientRoles: { name: RoleType; accessPolicy: AccessPolicy }[] = Object.entries(rolesSpec.roles)
  .filter(([key]) => key !== 'PATIENT')
  .map(([, role]) => ({
    name: role.name as RoleType,
    accessPolicy: { rule: role.accessPolicy as AccessPolicy['rule'] },
  }));

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
          accessPolicy: role.accessPolicy,
        });
        console.log(`${roleName} role accessPolicy patched: `, roleResult, JSON.stringify(roleResult.accessPolicy));
      } catch (err) {
        console.error(err);
        throw new Error(`Failed to patch role ${roleName}`);
      }
    } else {
      console.log(`creating ${roleName} role`);
      try {
        roleResult = await oystehr.role.create({ name: roleName, accessPolicy: role.accessPolicy });
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
