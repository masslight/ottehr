export const enum RoleType {
  NewUser = 'NewUser',
  Manager = 'Manager',
  FrontDesk = 'FrontDesk',
  Staff = 'Staff',
  Provider = 'Provider',
}

export async function getRoleId(roleName: string, token: string, projectApiUrl: string): Promise<string> {
  const headers = {
    accept: 'application/json',
    'content-type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  const existingRolesResponse = await fetch(`${projectApiUrl}/iam/roles`, {
    method: 'GET',
    headers: headers,
  });
  const existingRoles = (await existingRolesResponse.json()) as { name: string; id: string }[];
  const roleId = existingRoles.find((existingRole: any) => existingRole.name === roleName)?.id;

  if (!roleId) {
    throw new Error('Role not found');
  }

  return roleId;
}
