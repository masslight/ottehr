// Authorisation for the Easy Chart endpoints. Do this now, not later — retrofitting it means
// auditing every call site twice.
//
// These endpoints do their FHIR work under the project's M2M token, so the SDK never consults the
// caller's permissions. `"type": "http_auth"` only proves the token is valid FOR THE PROJECT.
// Without the checks below, ANY authenticated token could plan against ANY encounterId and read that
// patient's demographics.

import { captureException } from '@sentry/aws-serverless';
import { Encounter } from 'fhir/r4b';
import { EASY_CHART_ROLES } from 'utils/lib/easy-chart/access';
import { Secrets } from 'utils/lib/secrets';
import { RoleType } from 'utils/lib/types/api/user.types';
import { NOT_AUTHORIZED } from 'utils/lib/types/errors';
import { getUserToken, isTestM2MClient, requireUserWithRole } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { ZambdaInput } from '../../shared/types/common';

export interface AuthorizedCaller {
  userToken: string;
  /** True for server-side automation and the eval harness, which have no user profile. */
  isServiceClient: boolean;
}

/**
 * Steps, in order:
 *  1. `getUserToken` — throws on a missing or blank Authorization header.
 *  2. Test M2M client → allow. Server-side automation and the eval harness authenticate with
 *     client_credentials; they have no user profile and could never pass a role check. Wrapped in
 *     try/catch because it decodes the JWT and throws on a malformed one.
 *  3. Otherwise require one of EASY_CHART_ROLES — the same set the router lets onto the page.
 *  4. When an encounterId was supplied and the caller is a user, read that Encounter with the
 *     CALLER'S OWN token so FHIR applies their permissions.
 */
export async function authorizeEasyChartRequest(
  input: ZambdaInput,
  encounterId: string | undefined,
  secrets: Secrets | null,
  zambdaName: string
): Promise<AuthorizedCaller> {
  const userToken = getUserToken(input);

  let isServiceClient = false;
  try {
    isServiceClient = isTestM2MClient(userToken, secrets);
  } catch (error) {
    // A malformed JWT is not a service client; it is an unauthenticated caller.
    console.log(`[${zambdaName}] could not decode the caller token`);
    void error;
    isServiceClient = false;
  }

  if (!isServiceClient) {
    await requireUserWithRole(userToken, secrets, [...EASY_CHART_ROLES] as RoleType[]);
    if (encounterId) {
      await assertCallerCanReadEncounter(userToken, encounterId, secrets, zambdaName);
    }
  }

  return { userToken, isServiceClient };
}

/**
 * FAIL CLOSED. 401, 403 and 404 all become NOT_AUTHORIZED — 404 too, so the endpoint is not an
 * existence oracle for encounter ids. Any other error also denies, but is captured to Sentry so a
 * broken FHIR path shows up as an outage rather than silently denying every provider.
 */
async function assertCallerCanReadEncounter(
  userToken: string,
  encounterId: string,
  secrets: Secrets | null,
  zambdaName: string
): Promise<void> {
  const callerClient = createClinicalOystehrClient(userToken, secrets);
  try {
    await callerClient.fhir.get<Encounter>({ resourceType: 'Encounter', id: encounterId });
  } catch (error) {
    const code = (error as { code?: number } | undefined)?.code;
    if (code === 401 || code === 403 || code === 404) {
      console.log(`[${zambdaName}] encounter access denied (status ${code})`);
      throw NOT_AUTHORIZED;
    }
    console.error(`[${zambdaName}] encounter access check failed unexpectedly`);
    captureException(error);
    throw NOT_AUTHORIZED;
  }
}
