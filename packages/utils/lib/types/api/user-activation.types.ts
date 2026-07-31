import { z } from 'zod';

export const UserActivationModeSchema = z.enum(['activate', 'deactivate'] as const);
export type UserActivationMode = z.infer<typeof UserActivationModeSchema>;

export const UserActivationZambdaInputSchema = z.object({
  userId: z.string().uuid(),
  userActivationMode: UserActivationModeSchema,
});
export type UserActivationZambdaInput = z.infer<typeof UserActivationZambdaInputSchema>;

/**
 * Result of the eRx unenrollment that deactivation attempts for the user's Practitioner:
 * - `unenrolled`: the practitioner was enrolled with the upstream eRx provider and has been removed
 * - `not-enrolled`: nothing to do — never registered with the eRx provider
 * - `not-configured`: eRx isn't set up for this project (the normal case on most lower envs)
 * - `no-practitioner`: the user has no Practitioner profile, so there is no eRx enrollment to remove
 * - `failed`: the attempt errored; reported to Sentry, and retried by re-running deactivate
 */
export const ErxUnenrollmentOutcomeSchema = z.enum([
  'unenrolled',
  'not-enrolled',
  'not-configured',
  'no-practitioner',
  'failed',
] as const);
export type ErxUnenrollmentOutcome = z.infer<typeof ErxUnenrollmentOutcomeSchema>;

export type UserActivationZambdaOutput = {
  message?: string;
  /** Only set for `deactivate`; activation leaves eRx alone and re-enrolls lazily on next use. */
  erxUnenrollment?: ErxUnenrollmentOutcome;
};
