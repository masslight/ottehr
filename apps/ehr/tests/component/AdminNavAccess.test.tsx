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

  it.each([RoleType.Staff, RoleType.Provider])('limits %s to the items that opt them in (Fax Logs)', (role) => {
    const groups = resolveAccessibleAdminNavGroups(hasRoleFor([role]));
    expect(groups.flatMap((group) => group.items.map((item) => item.path))).toEqual(['/admin/fax-logs']);
  });

  it('returns nothing for roles without any admin access', () => {
    expect(resolveAccessibleAdminNavGroups(hasRoleFor([RoleType.FrontDesk]))).toEqual([]);
  });
});
