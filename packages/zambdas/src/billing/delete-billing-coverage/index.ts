import Oystehr, { BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Coverage } from 'fhir/r4b';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import {
  accountUnlinkRequests,
  BillingFhirResource,
  createBillingClient,
  fetchById,
  getPatientAccounts,
} from '../shared';
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

// Hard delete: unlink the coverage from the patient's account(s) and delete the Coverage and its
// standalone RelatedPerson subscriber — all in one transaction so they succeed or fail together.
async function performEffect(oystehr: Oystehr, params: DeleteBillingCoverageParams): Promise<void> {
  const coverage = await fetchById<Coverage>(oystehr, 'Coverage', params.coverageId);
  const patientId = coverage.beneficiary?.reference?.split('/')[1];
  const coverageRef = `Coverage/${params.coverageId}`;

  const accounts = patientId ? await getPatientAccounts(oystehr, patientId) : [];

  const requests: BatchInputRequest<BillingFhirResource>[] = [
    // Unlink first so the Coverage isn't referenced when it's deleted.
    ...accountUnlinkRequests(accounts, coverageRef),
    { method: 'DELETE', url: coverageRef },
  ];

  const subscriberRef = coverage.subscriber?.reference;
  if (subscriberRef?.startsWith('RelatedPerson/')) {
    requests.push({ method: 'DELETE', url: subscriberRef });
  }

  await oystehr.fhir.transaction<BillingFhirResource>({ requests });
}
