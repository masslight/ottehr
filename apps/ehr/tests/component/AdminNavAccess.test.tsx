import { RoleType } from 'utils/lib/types/api/user.types';
import { describe, expect, it } from 'vitest';
import { adminNavGroups, resolveAccessibleAdminNavGroups } from '../../src/features/admin/adminNav';

const hasRoleFor =
  (userRoles: RoleType[]) =>
  (query: RoleType[]): boolean =>
    query.some((role) => userRoles.includes(role));

describe('resolveAccessibleAdminNavGroups', () => {
  it.each([RoleType.Administrator, RoleType.Manager])('gives %s the full admin nav', (role) => {
    expect(resolveAccessibleAdminNavGroups(hasRoleFor([role]))).toEqual(adminNavGroups);
  });

  it('gives Customer Support every admin page except Inventory, which is for clinical staff', () => {
    const groups = resolveAccessibleAdminNavGroups(hasRoleFor([RoleType.CustomerSupport]));
    const expected = adminNavGroups.map((group) => ({
      ...group,
      items: group.items.filter((item) => item.path !== '/admin/inventory'),
    }));
    expect(groups).toEqual(expected);
  });

  it('limits Staff to Inventory and Action Logs', () => {
    const role = RoleType.Staff;
    const groups = resolveAccessibleAdminNavGroups(hasRoleFor([role]));
    expect(groups.flatMap((group) => group.items.map((item) => item.path))).toEqual([
      '/admin/inventory',
      '/admin/action-logs',
    ]);
  });

  it.each([RoleType.Provider, RoleType.Clinician])('limits %s to Inventory', (role) => {
    const groups = resolveAccessibleAdminNavGroups(hasRoleFor([role]));
    expect(groups.flatMap((group) => group.items.map((item) => item.path))).toEqual(['/admin/inventory']);
  });
});
