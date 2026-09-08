import { APIGatewayProxyResult } from 'aws-lambda';
import {
  isVersionConflictError,
  makeOptimisticLockIfMatchHeader,
  withVersionConflictRetries,
} from 'utils/lib/fhir/helpers';
import { getSecret, SecretsKeys } from 'utils/lib/secrets';
import { INVALID_INPUT_ERROR, isApiError, PRECONDITION_FAILED } from 'utils/lib/types/errors';
import {
  claimRejectionRequests,
  claimStatusCompletionRequest,
  loadClaimStatusContext,
} from '../../../billing/claim-status-processing';
import { claimMetaTagsWithProvenanceRequests, resolveClaimActor } from '../../../billing/provenance';
import { createBillingClient, createEraReadClient } from '../../../billing/shared';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { sendErrors } from '../../../shared/errors';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

export const index = wrapHandler(
  'sub-claim-status-response',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    const { secrets, claimResponseId } = validateRequestParameters(input);
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const billingClient = createBillingClient(m2mToken, secrets);
    const projectClient = createEraReadClient(m2mToken, secrets);
    try {
      await withVersionConflictRetries(async () => {
        const context = await loadClaimStatusContext(projectClient, claimResponseId);
        if (!context) return;
        const completion = claimStatusCompletionRequest(context.claimResponse);
        if (!completion) return;
        const agent = await resolveClaimActor('system', billingClient, undefined, secrets);
        const requests = claimRejectionRequests(context, agent);
        const { claim } = context;
        // History-only writes also lock the Claim, preventing duplicate messages across concurrent responses.
        if (requests.length > 0 && !requests.some((request) => request.url === `/Claim/${claim.id}`)) {
          if (!makeOptimisticLockIfMatchHeader(claim)) {
            throw INVALID_INPUT_ERROR(`Claim/${claim.id} needs a version for rejection history processing`);
          }
          requests.unshift(...claimMetaTagsWithProvenanceRequests(claim, claim.meta?.tag ?? [], 'statusChange', agent));
        }
        await billingClient.fhir.transaction({ requests: [...requests, completion] });
      });
    } catch (cause) {
      const error = isVersionConflictError(cause)
        ? {
            ...PRECONDITION_FAILED(
              `ClaimResponse/${claimResponseId} processing conflicted with another update and was not processed`
            ),
            cause,
          }
        : cause;
      if (isApiError(error)) await sendErrors(error, getSecret(SecretsKeys.ENVIRONMENT, secrets));
      throw error;
    }
    return { statusCode: 200, body: JSON.stringify({}) };
  }
);
