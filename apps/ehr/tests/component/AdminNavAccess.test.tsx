import { RoleType } from 'utils';
import { describe, expect, it } from 'vitest';
import { adminNavGroups, resolveAccessibleAdminNavGroups } from '../../src/features/admin/adminNav';

const hasRoleFor =
  (userRoles: RoleType[]) =>
  (query: RoleType[]): boolean =>
    query.some((role) => userRoles.includes(role));

describe('resolveAccessibleAdminNavGroups', () => {
  it.each([RoleType.Administrator, RoleType.Manager, RoleType.CustomerSupport])(
    'gives %s the full admin nav',
    (role) => {
      expect(resolveAccessibleAdminNavGroups(hasRoleFor([role]))).toEqual(adminNavGroups);
    }
  );

  it('limits Staff to Action Logs', () => {
    const role = RoleType.Staff;
    const groups = resolveAccessibleAdminNavGroups(hasRoleFor([role]));
    expect(groups.flatMap((group) => group.items.map((item) => item.path))).toEqual(['/admin/action-logs']);
  });

  it.each([RoleType.Provider, RoleType.FrontDesk])('returns nothing for %s', (role) => {
    expect(resolveAccessibleAdminNavGroups(hasRoleFor([role]))).toEqual([]);
  });
});
