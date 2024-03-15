import { User } from '@zapehr/sdk';

export function checkUserIsActive(user: User): boolean {
  // If user has zero roles their access policy is an implicit deny
  return (user as any).roles?.length > 0;
}
