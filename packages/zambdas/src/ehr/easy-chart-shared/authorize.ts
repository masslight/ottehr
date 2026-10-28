// Authorisation for the Easy Chart endpoints. They work under the project's M2M token, so FHIR never
// checks the caller: without this, any valid project token could read any encounter through them.

import { captureException } from '@sentry/node-core/light';
import { Encounter } from 'fhir/r4b';
import { EASY_CHART_ROLES } from 'utils/lib/easy-chart/access';
import { Secrets } from 'utils/lib/secrets';
import { NOT_AUTHORIZED } from 'utils/lib/types/errors';
import { getUserToken, isTestM2MClient, requireUserWithRole } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { ZambdaInput } from '../../shared/types/common';

export interface AuthorizedCaller {
  userToken: string;
  /** True for the project's own M2M client (AUTH0_CLIENT), which has no user profile. */
  isServiceClient: boolean;
}

/**
 * The project's own M2M client is allowed as is: it already holds the credentials these endpoints use.
 * A user needs one of EASY_CHART_ROLES and, when an encounter is named, must be able to read it with their
 * own token.
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
  } catch {
    // A malformed JWT is not a service client; the role check below refuses it.
    console.log(`[${zambdaName}] could not decode the caller token`);
  }

  if (!isServiceClient) {
    await requireUserWithRole(userToken, secrets, [...EASY_CHART_ROLES]);
    if (encounterId) {
      await assertCallerCanReadEncounter(userToken, encounterId, secrets, zambdaName);
    }
  }

  return { userToken, isServiceClient };
}

/**
 * Fail closed. 404 is also NOT_AUTHORIZED, so the endpoint is no oracle for encounter ids; unexpected
 * errors deny too but go to Sentry, so an outage does not look like a permissions problem.
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
