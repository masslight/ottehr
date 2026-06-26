import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Claim } from 'fhir/r4b';
import {
  AR_STAGE,
  CLAIM_STATUS_FIELDS_BY_KEY,
  getClaimStatusFieldValue,
  SubmitBillingClaimResult,
  SubmitBillingClaimsResponse,
} from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { applyClaimStatusField, createBillingClient, fetchById } from '../shared';
import { SubmitBillingClaimsParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'submit-billing-claim';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.group('validateRequestParameters');
  const params = validateRequestParameters(input);
  const { secrets, ...paramsToLog } = params;
  console.groupEnd();
  console.debug('validateRequestParameters success', paramsToLog);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createBillingClient(m2mToken, secrets);

  console.group('performEffect');
  const response = await performEffect(oystehr, params);
  console.groupEnd();
  console.debug('performEffect success', response);

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

export async function performEffect(
  oystehr: Oystehr,
  params: SubmitBillingClaimsParams
): Promise<SubmitBillingClaimsResponse> {
  const results: SubmitBillingClaimResult[] = [];

  for (const claimId of params.claimIds) {
    try {
      const claim = await fetchById<Claim>(oystehr, 'Claim', claimId);

      if (getClaimStatusFieldValue(claim, CLAIM_STATUS_FIELDS_BY_KEY.arStage) !== AR_STAGE.insurancePayer) {
        results.push({
          claimId,
          status: 'error',
          error: 'Claim is not in Insurance Payer AR',
        });
        continue;
      }

      await oystehr.rcm.submitClaim({ claimId });

      const submitted = await fetchById<Claim>(oystehr, 'Claim', claimId);
      await applyClaimStatusField(oystehr, submitted, 'insuranceArStatus', 'submitted');

      results.push({
        claimId,
        status: 'submitted',
      });
    } catch (err) {
      results.push({
        claimId,
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { results };
}
