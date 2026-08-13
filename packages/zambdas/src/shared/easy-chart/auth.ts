// Caller authorization for the easy-chart zambdas.
//
// These endpoints do all of their FHIR work under the PROJECT'S M2M token (full clinical scope), so
// the SDK never consults the caller's own permissions. `"type": "http_auth"` in zambdas.json only
// proves the bearer token is valid for the project — on its own that means any authenticated token
// can plan/review/chart against ANY encounterId. Each handler must therefore check the caller
// explicitly, which is what this module is for.
import Oystehr from '@oystehr/sdk';
import { captureException } from '@sentry/aws-serverless';
import { Encounter } from 'fhir/r4b';
import { NOT_AUTHORIZED, RoleType, Secrets } from 'utils';
import { isTestM2MClient, requireUserWithRole } from '../auth';
import { createClinicalOystehrClient } from '../helpers';

// The roles that can open the Easy Chart page in the EHR — deliberately the SAME set as the two
// route groups that mount it in apps/ehr/src/App.tsx. A role that can reach the page must be able to
// use it, and a role that cannot must not be able to drive the same actions through the API.
export const EASY_CHART_ROLES: RoleType[] = [
  RoleType.Administrator,
  RoleType.Manager,
  RoleType.CustomerSupport,
  RoleType.Provider,
  RoleType.Staff,
];

// isTestM2MClient decodes the JWT and throws on a malformed one; a token we cannot even parse is
// simply "not the M2M client" and falls through to the user check, which rejects it properly.
function isProjectM2MClient(token: string, secrets: Secrets | null): boolean {
  try {
    return isTestM2MClient(token, secrets);
  } catch {
    return false;
  }
}

export interface EasyChartCaller {
  // True when the caller is the project's own M2M client rather than a logged-in user.
  isM2M: boolean;
}

// Authorize the caller of an easy-chart endpoint: either the project's M2M client, or a user holding
// one of `roles`. Returns which of the two it was, because the encounter-access check below is
// meaningful only for users.
export async function requireEasyChartCaller(
  userToken: string,
  secrets: Secrets | null,
  roles: RoleType[] = EASY_CHART_ROLES
): Promise<EasyChartCaller> {
  // Server-side automation (the ambient-scribe plan precompute's callers, the eval harness in
  // scripts/easy-chart-eval) authenticates with client_credentials: no user profile, no roles, so it
  // could never pass the role check. Its credentials ARE the project's, so it is trusted here
  // instead — the same assumption every zambda already makes about its own m2mToken.
  if (isProjectM2MClient(userToken, secrets)) {
    return { isM2M: true };
  }
  await requireUserWithRole(userToken, secrets, roles);
  return { isM2M: false };
}

// Verify the CALLER (not our M2M client) may see this encounter, by reading it with their own token
// and letting FHIR apply their permissions. This is the check that closes the hole: without it the
// endpoints happily read any patient's demographics into the prompt on request.
export async function requireEncounterAccess(
  userToken: string,
  encounterId: string,
  secrets: Secrets | null
): Promise<void> {
  const asCaller = createClinicalOystehrClient(userToken, secrets);
  try {
    await asCaller.fhir.get<Encounter>({ resourceType: 'Encounter', id: encounterId });
  } catch (error) {
    // FAIL CLOSED. 401/403 = the caller may not see this encounter; 404 = it does not exist, and
    // answering "not authorized" rather than "not found" keeps the endpoint from being an existence
    // oracle for encounter ids. Anything else means we could not VERIFY access — an unverifiable
    // request must not proceed either, but it is captured so a broken FHIR path shows up as an
    // outage instead of silently denying every provider.
    const sdkError = error instanceof Oystehr.OystehrSdkError ? error : undefined;
    if (!sdkError || ![401, 403, 404].includes(sdkError.code)) {
      console.error(`Could not verify caller access to encounter ${encounterId}:`, error);
      captureException(error);
    }
    throw NOT_AUTHORIZED;
  }
}

// The whole check for an endpoint that operates on one encounter: authorize the caller, then confirm
// their access to that encounter. `encounterId` is optional because it is optional on the planner /
// review inputs (headless eval runs pass none); when absent there is no patient data to protect
// beyond what the caller already put in the request body.
export async function requireEasyChartEncounterAccess(
  userToken: string,
  encounterId: string | undefined,
  secrets: Secrets | null
): Promise<EasyChartCaller> {
  const caller = await requireEasyChartCaller(userToken, secrets);
  if (encounterId && !caller.isM2M) {
    await requireEncounterAccess(userToken, encounterId, secrets);
  }
  return caller;
}
