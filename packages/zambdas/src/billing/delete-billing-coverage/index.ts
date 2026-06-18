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

// Hard delete: remove the Coverage resource and unlink it from the patient's billing Account so it
// disappears from the patient details view entirely.
async function performEffect(oystehr: Oystehr, params: DeleteBillingCoverageParams): Promise<void> {
  const coverage = await fetchById<Coverage>(oystehr, 'Coverage', params.coverageId);
  const patientId = coverage.beneficiary?.reference?.split('/')[1];

  if (patientId) {
    await unlinkCoverageFromAccount(oystehr, patientId, params.coverageId);
  }

  await oystehr.fhir.delete({ resourceType: 'Coverage', id: params.coverageId });
}
