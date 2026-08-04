import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { GetBillingPatientBalanceResponse, PatientArClaimItem, PatientBalanceSummary } from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { fetchAllActivePatientArClaims } from '../search-billing-patient-ar-claims/handler';
import { createBillingClient } from '../shared';
import { GetBillingPatientBalanceParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'get-billing-patient-balance';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);

  const response = await performEffect(oystehr, params);
  return { statusCode: 200, body: JSON.stringify(response) };
});

export async function performEffect(
  oystehr: Oystehr,
  params: GetBillingPatientBalanceParams
): Promise<GetBillingPatientBalanceResponse> {
  const claims = await fetchAllActivePatientArClaims(oystehr, {
    encounterIds: params.encounterIds,
    // overpaid claims have negative balances; callers need them to surface patient credit
    includeZeroBalance: true,
    // A biller can mark a claim fully paid by hand. Keep those out of the patient balance display.
    excludeFullyPaid: true,
  });
  return { claims, balance: summarizePatientBalance(claims) };
}

export function summarizePatientBalance(claims: PatientArClaimItem[]): PatientBalanceSummary {
  const balances = claims.map((claim) => claim.balance);
  return {
    currentBalance: balances.reduce((sum, balance) => sum + balance, 0),
    claimsWithPatientBalance: balances.filter((balance) => balance > 0).length,
  };
}
