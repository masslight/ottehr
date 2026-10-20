import { User } from '@oystehr/sdk';
import { RoleType } from 'utils/lib/types/api/user.types';

/**
 * Resolves the sign-review prompt to store.
 *
 * The prompt is configured by Ottehr customer support on the practice's behalf, so Administrators
 * and Managers may submit this form but may not change that one field. Their submission is dropped
 * rather than rejected: every client round-trips the whole config, and react-hook-form submits the
 * value it loaded even for a field it never rendered, so a prompt edited by customer support after
 * the form loaded would otherwise make an unrelated save — a change to the MDM default text, say —
 * fail with NOT_AUTHORIZED and nothing written.
 *
 * Absent also means "unchanged", so older clients that omit the field can't wipe the stored prompt.
 */
export const resolveSignReviewPrompt = (
  user: User,
  incomingPrompt: string | undefined,
  storedPrompt: string | undefined
): string | undefined => {
  if (incomingPrompt === undefined || incomingPrompt === storedPrompt) return storedPrompt;
  if (user.roles?.some((role) => role.name === RoleType.CustomerSupport)) return incomingPrompt;

  // Not an error path, but a real attempt to change a customer-support-only field should be visible.
  console.warn(
    `User ${user.id} submitted a changed signReviewPrompt without the ${RoleType.CustomerSupport} role; keeping the stored prompt`
  );
  return storedPrompt;
};
