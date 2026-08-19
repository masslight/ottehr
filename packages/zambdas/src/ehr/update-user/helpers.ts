import { RoleType, User } from 'utils/lib/types/api/user.types';
import { NOT_AUTHORIZED } from 'utils/lib/types/errors';

/** Roles permitted to edit anyone's record and to assign roles. */
export const USER_EDIT_ADMIN_ROLES = [RoleType.Administrator, RoleType.CustomerSupport];

/**
 * Decides whether `caller` may edit `targetUserId`, and whether they may do so as an admin.
 *
 * Two callers are allowed: an admin editing anyone, and any user editing their own record. Everyone
 * else is refused. The admin flag is returned rather than re-derived because it also decides whether
 * submitted roles are honoured — see {@link resolveEffectiveRoles}.
 */
export const authorizeUserEdit = (caller: Pick<User, 'id' | 'roles'>, targetUserId: string): boolean => {
  const callerIsAdmin = caller.roles?.some((role) => USER_EDIT_ADMIN_ROLES.includes(role.name as RoleType)) ?? false;
  if (!callerIsAdmin && caller.id !== targetUserId) {
    throw NOT_AUTHORIZED;
  }
  return callerIsAdmin;
};

/**
 * The roles to write, and to evaluate the NPI invariant against.
 *
 * A self-editing non-admin doesn't get to choose roles, so their submission is discarded in favour of
 * the roles the target user already holds. Substituting rather than dropping matters: an empty list
 * would both clear the user's roles and, because the NPI invariant keys off this same list, strip a
 * provider's NPI on every self-save.
 */
export const resolveEffectiveRoles = (
  callerIsAdmin: boolean,
  submittedRoles: RoleType[] | undefined,
  targetUser: Pick<User, 'roles'>
): RoleType[] | undefined =>
  callerIsAdmin ? submittedRoles : (targetUser.roles?.map((role) => role.name) as RoleType[] | undefined);
