import { User } from '@zapehr/sdk';

export function checkUserIsActive(user: User): boolean {
  // If user has inactive role their access policy is an explicit deny all
  const userInactive = (user as any).roles?.find((role: any) => role.name === 'Inactive');
  if (userInactive || (user as any).roles.length == 0) {
    return false;
  } else {
    return true;
  }
}
