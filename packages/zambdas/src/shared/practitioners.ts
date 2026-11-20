import Oystehr, { User } from '@oystehr/sdk';
import { Practitioner, Reference } from 'fhir/r4b';
import { userMe } from 'utils/lib/auth/user-me.helper';
import { chunkThings } from 'utils/lib/fhir/chat';
import { getFirstName, getFullestAvailableName, getLastName } from 'utils/lib/fhir/patient';
import { getIdFromReference } from 'utils/lib/fhir/reference';
import { Secrets } from 'utils/lib/secrets';

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
export async function getMyPractitionerId(token: string, secrets: Secrets | null): Promise<string> {
  const myPractitionerId = getIdFromReference((await userMe(token, secrets)).profile, 'Practitioner');
  if (!myPractitionerId) throw new Error("Can't receive practitioner resource id attached to current user");
  return myPractitionerId;
}

/**
 * The calling user as a FHIR Reference, named the way their Practitioner record names them.
 *
 * Anything that records "who did this" — a report's author, a task owner, an extension crediting an action —
 * should build the reference here, so one person is spelled the same way wherever they appear.
 *
 * Note for callers that narrow `secrets`: `userMe` reads ENVIRONMENT through `getSecret`, which only falls
 * back to `process.env` when the whole secrets object is null. A narrowed object that drops ENVIRONMENT
 * makes this throw.
 */
export async function resolveCallerPractitionerRef(
  token: string,
  secrets: Secrets | null,
  oystehr: Oystehr
): Promise<Reference> {
  const user = await userMe(token, secrets);
  const practitionerId = getIdFromReference(user.profile, 'Practitioner');
  if (!practitionerId) throw new Error("Can't receive practitioner resource id attached to current user");

  const practitioner = await oystehr.fhir.get<Practitioner>({ resourceType: 'Practitioner', id: practitionerId });
  return { reference: user.profile, display: getFullestAvailableName(practitioner) ?? user.name };
}

/**
 * Same as resolveCallerPractitionerRef but for an already-resolved user, and never throws:
 * a failed name lookup falls back to the Oystehr user name rather than blocking the caller's action.
 * Display is first + last name only — no credentials.
 */
export async function practitionerRefForUser(user: User, oystehr: Oystehr): Promise<Reference> {
  const practitionerId = getIdFromReference(user.profile, 'Practitioner');
  if (!practitionerId) return { reference: user.profile, display: user.name };
  try {
    const practitioner = await oystehr.fhir.get<Practitioner>({ resourceType: 'Practitioner', id: practitionerId });
    return { reference: user.profile, display: practitionerFirstLastName(practitioner) || user.name };
  } catch (error) {
    console.error('Failed to resolve practitioner name for user', user.id, error);
    return { reference: user.profile, display: user.name };
  }
}

// A Practitioner's first + last name, no credentials; empty when the record names neither.
export function practitionerFirstLastName(practitioner: Practitioner): string {
  return [getFirstName(practitioner), getLastName(practitioner)].filter(Boolean).join(' ');
}

const PRACTITIONER_NAMES_BATCH_SIZE = 100;

// First + last names by Practitioner id, batched into id searches; ids without a named record are left out.
export async function fetchPractitionerFirstLastNames(
  oystehr: Oystehr,
  practitionerIds: string[]
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  for (const batch of chunkThings([...new Set(practitionerIds)], PRACTITIONER_NAMES_BATCH_SIZE)) {
    const practitioners = (
      await oystehr.fhir.search<Practitioner>({
        resourceType: 'Practitioner',
        params: [
          { name: '_id', value: batch.join(',') },
          { name: '_count', value: String(batch.length) },
        ],
      })
    ).unbundle();
    for (const practitioner of practitioners) {
      const name = practitionerFirstLastName(practitioner);
      if (practitioner.id && name) names.set(practitioner.id, name);
    }
  }
  return names;
}
