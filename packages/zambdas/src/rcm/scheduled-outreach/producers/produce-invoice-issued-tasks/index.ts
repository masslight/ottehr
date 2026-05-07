import { APIGatewayProxyResult } from 'aws-lambda';
import { MISSING_REQUIRED_PARAMETERS } from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../../../shared';
import { produceInvoiceIssuedOutreach } from '../shared';

let m2mToken: string;

const ZAMBDA_NAME = 'produce-outreach-invoice-issued-tasks';

/**
 * Zambda handler: thin wrapper over produceInvoiceIssuedOutreach.
 *
 * Input body: Invoice resource or { invoiceId: string }
 */
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  if (!input.body) throw MISSING_REQUIRED_PARAMETERS(['body']);
  if (!input.secrets) throw new Error('Secrets are not defined');

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, input.secrets);
  const oystehr = createOystehrClient(m2mToken, input.secrets);

  const body = JSON.parse(input.body);

  const result = await produceInvoiceIssuedOutreach({
    invoice: body.resourceType === 'Invoice' ? body : undefined,
    invoiceId: body.invoiceId,
    oystehr,
  });

  return {
    statusCode: 200,
    body: JSON.stringify({
      created: result.created.length,
      skipped: result.skipped.length,
    }),
  };
});
