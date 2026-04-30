import { removePrefix, Secrets, userMe } from 'utils';

/**
 * Resolve the calling user's Practitioner id.
 *
 * Uses the `userMe` helper from utils which transparently handles both
 * user tokens and M2M tokens (in non-production environments) — see
 * `packages/utils/lib/auth/user-me.helper.ts`. Previously this called
 * `oystehr.user.me()` directly, which throws Forbidden for M2M tokens
 * and prevented backend/integration callers (and synthesis tooling)
 * from invoking zambdas that depend on this helper.
 */
export async function getMyPractitionerId(userToken: string, secrets: Secrets | null): Promise<string> {
  const userInfo = await userMe(userToken, secrets);
  const myPractitionerId = removePrefix('Practitioner/', userInfo.profile);
  if (!myPractitionerId) throw new Error("Can't receive practitioner resource id attached to current user");
  return myPractitionerId;
}
