import { APIGatewayProxyResult } from 'aws-lambda';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { createBillingClient, createEraReadClient } from '../../shared';
import { computePatientPaymentsDetail } from '../definitions/patient-payments.report';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'get-billing-patient-payments-report';

// Live drill-down: individual payments (optionally row-filtered) with Stripe status. The cached
// rollup is served by get-billing-report (kind 'patient-payments').
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);
  // encounters/appointments are clinical (untagged) resources in the same store
  const untaggedClient = createEraReadClient(m2mToken, params.secrets);

  const response = await computePatientPaymentsDetail(oystehr, untaggedClient, params.secrets, params);
  return { statusCode: 200, body: JSON.stringify(response) };
});
