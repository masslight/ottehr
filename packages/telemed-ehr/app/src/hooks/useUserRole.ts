import { useCommonStore } from '../state/common.store';
import { RoleType } from '../types/types';

export function useUserRole(): RoleType | undefined {
  const user = useCommonStore((state) => state.user);
  let role: RoleType | undefined;

  if (user) {
    const roleName = (user as any).roles[0].name;
    if (roleName === RoleType.Administrator) {
      role = RoleType.Administrator;
    } else if (roleName === RoleType.Manager) {
      role = RoleType.Manager;
    } else if (roleName === RoleType.Staff) {
      role = RoleType.Staff;
    } else if (roleName === RoleType.Provider) {
      role = RoleType.Provider;
    }
  }

  return role;
}
