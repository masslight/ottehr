import { APIGatewayProxyResult } from 'aws-lambda';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../../../shared';
import { produceInvoiceDueOutreach } from '../shared';

let m2mToken: string;

const ZAMBDA_NAME = 'cron-outreach-invoice-due';

/**
 * Zambda handler: thin wrapper over produceInvoiceDueOutreach.
 *
 * Runs daily as a cron to find past-due invoices and create outreach tasks.
 */
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  if (!input.secrets) throw new Error('Secrets are not defined');

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, input.secrets);
  const oystehr = createOystehrClient(m2mToken, input.secrets);

  const result = await produceInvoiceDueOutreach(oystehr, input.secrets);

  return {
    statusCode: 200,
    body: JSON.stringify(result),
  };
});
