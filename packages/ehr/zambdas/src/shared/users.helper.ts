import Oystehr, { RoleListItem, UserListItem } from '@oystehr/sdk';

export async function getEmployees(oystehr: Oystehr): Promise<UserListItem[]> {
  console.log('Getting all employees..');
  const allEmployees = (await oystehr.user.list()).filter(
    (user) => !user.name.startsWith('+') && user.profile.includes('Practitioner')
  );
  return allEmployees;
}

export async function getRoles(oystehr: Oystehr): Promise<RoleListItem[]> {
  console.log('Getting roles...');
  return oystehr.role.list();
}

export async function getRoleMembers(
  roleId: string,
  oystehr: Oystehr
): Promise<{ id: string; name?: string; profile?: string }[]> {
  let cursor: string | null = '';
  const COUNT = 100;
  const members = [];

  console.log(`search limit: ${COUNT}`);

  do {
    // explicit type required by circularity https://github.com/microsoft/TypeScript/issues/36687
    const response: Awaited<ReturnType<typeof oystehr.user.listV2>> = await oystehr.user.listV2({
      cursor,
      limit: COUNT,
      roleId,
      sort: 'name',
    });
    members.push(...response.data);
    cursor = response.metadata.nextCursor;
  } while (cursor !== null);

  return members;
}
