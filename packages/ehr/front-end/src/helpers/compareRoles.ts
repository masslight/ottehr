import { RoleType } from '../types/types';

export function compareRoles(roleOne: RoleType, roleTwo: RoleType): boolean {
  return roleOne === roleTwo;
}
