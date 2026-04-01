import { APIGatewayProxyResult } from 'aws-lambda';
import { Organization } from 'fhir/r4b';
import { getSecret, SecretsKeys } from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { createCandidClientIfConfigured, syncToggleCandidEmployerPayer } from '../candid-sync';
import { getCandidPayerIdFromOrganization, isEmployerOrganization } from '../helpers';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
export const index = wrapHandler('deactivate-employer', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const { employerId, secrets } = validateRequestParameters(input);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    const existing = await oystehr.fhir.get<Organization>({
      resourceType: 'Organization',
      id: employerId,
    });

    if (!isEmployerOrganization(existing)) {
      throw new Error(`Organization ${employerId} is not an occupational medicine employer`);
    }

    const updated = await oystehr.fhir.update<Organization>(
      { ...existing, active: false },
      { optimisticLockingVersionId: existing.meta?.versionId }
    );

    // Sync deactivation to Candid (best-effort)
    const candid = createCandidClientIfConfigured(secrets);
    if (candid) {
      const candidPayerId = getCandidPayerIdFromOrganization(existing);
      if (candidPayerId) {
        await syncToggleCandidEmployerPayer(candid, candidPayerId, false);
      } else {
        console.log(`[deactivate-employer] No Candid payer ID on Organization ${employerId} — skipping Candid toggle`);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify(updated),
    };
  } catch (error: unknown) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('deactivate-employer', error, ENVIRONMENT);
  }
});
