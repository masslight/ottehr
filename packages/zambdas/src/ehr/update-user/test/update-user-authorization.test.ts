import { RoleType, User } from 'utils/lib/types/api/user.types';
import { describe, expect, it } from 'vitest';
import { authorizeUserEdit, resolveEffectiveRoles } from '../helpers';

const makeCaller = (id: string, roleNames: RoleType[]): Pick<User, 'id' | 'roles'> =>
  ({
    id,
    roles: roleNames.map((name, index) => ({ id: `role-${index}`, name })),
  }) as Pick<User, 'id' | 'roles'>;

describe('authorizeUserEdit', () => {
  it.each([RoleType.Administrator, RoleType.CustomerSupport])('lets %s edit another user', (role) => {
    expect(authorizeUserEdit(makeCaller('admin-1', [role]), 'someone-else')).toBe(true);
  });

  it('lets a non-admin edit their own record, but not as an admin', () => {
    expect(authorizeUserEdit(makeCaller('user-1', [RoleType.Provider]), 'user-1')).toBe(false);
  });

  it('refuses a non-admin editing somebody else', () => {
    expect(() => authorizeUserEdit(makeCaller('user-1', [RoleType.Provider]), 'user-2')).toThrow();
  });

  it('refuses a caller with no roles at all editing somebody else', () => {
    expect(() => authorizeUserEdit(makeCaller('user-1', []), 'user-2')).toThrow();
  });

  it('still lets a roleless user edit their own record', () => {
    expect(authorizeUserEdit(makeCaller('user-1', []), 'user-1')).toBe(false);
  });
});

describe('resolveEffectiveRoles', () => {
  const targetUser = { roles: [{ id: 'r1', name: RoleType.Provider }] } as Pick<User, 'roles'>;

  it('honours the submitted roles for an admin caller', () => {
    expect(resolveEffectiveRoles(true, [RoleType.Manager, RoleType.Staff], targetUser)).toEqual([
      RoleType.Manager,
      RoleType.Staff,
    ]);
  });

  it("discards a self-editing caller's submitted roles — this is what blocks self-promotion", () => {
    expect(resolveEffectiveRoles(false, [RoleType.Administrator], targetUser)).toEqual([RoleType.Provider]);
  });

  it("preserves a provider's existing roles so a self-save doesn't strip their NPI", () => {
    // `effectiveNpi` keys off this list; returning an empty array here would drop the NPI from the
    // Practitioner every time a provider saved their own record.
    expect(resolveEffectiveRoles(false, undefined, targetUser)).toContain(RoleType.Provider);
  });

  it('yields no roles when a self-editing caller holds none', () => {
    expect(resolveEffectiveRoles(false, [RoleType.Provider], { roles: [] } as unknown as Pick<User, 'roles'>)).toEqual(
      []
    );
  });
});
