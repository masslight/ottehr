import { APIGatewayProxyResult } from 'aws-lambda';
import { getOrCreateInvoicingConfig } from '../../rcm/invoice-config/helpers';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { createBillingClient } from '../shared';

let m2mToken: string;
const ZAMBDA_NAME = 'get-billing-invoice-config';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, input.secrets);
  const oystehr = createBillingClient(m2mToken, input.secrets);

  const response = await getOrCreateInvoicingConfig(oystehr);
  return { statusCode: 200, body: JSON.stringify(response) };
});
