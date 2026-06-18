import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Coverage } from 'fhir/r4b';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { createBillingClient, fetchById, unlinkCoverageFromAccount } from '../shared';
import { DeleteBillingCoverageParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'delete-billing-coverage';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);

  await performEffect(oystehr, params);
  return { statusCode: 200, body: JSON.stringify({ deleted: true }) };
});

// Soft delete: cancel the Coverage and unlink it from the patient's billing Account, mirroring the
// clinical EHR's remove-coverage flow rather than hard-deleting (claims may still reference it).
async function performEffect(oystehr: Oystehr, params: DeleteBillingCoverageParams): Promise<void> {
  const coverage = await fetchById<Coverage>(oystehr, 'Coverage', params.coverageId);
  const patientId = coverage.beneficiary?.reference?.split('/')[1];

  coverage.status = 'cancelled';
  await oystehr.fhir.update<Coverage>(coverage);

  if (patientId) {
    await unlinkCoverageFromAccount(oystehr, patientId, params.coverageId);
  }
}
