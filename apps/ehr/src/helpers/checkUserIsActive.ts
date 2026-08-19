import { User } from '@oystehr/sdk';

/**
 * Whether a user's account is active, meaning it has not been deactivated.
 *
 * Deactivation is the `Inactive` role, whose access policy is an explicit deny-all. This matches how
 * `get-employees` derives the Status column, so the list and the record page agree.
 *
 * A user holding *no* roles is deliberately still "active" here. That's a user who signed up but was
 * never set up as an employee — the record page reports that as needing setup and offers to delete
 * them. Treating them as deactivated would disable the very form used to assign them a role, and
 * would label them Deactivated on a page whose list row says Active.
 */
export function checkUserIsActive(user: User): boolean {
  return !(user as any).roles?.some((role: any) => role.name === 'Inactive');
}
