import { APIGatewayProxyResult } from 'aws-lambda';
import { INVALID_INPUT_ERROR, MISSING_REQUIRED_PARAMETERS } from 'utils/lib/types/errors';
import { ZambdaInput } from '../../../../shared/types/common';
import { checkOrCreateM2MClientToken } from '../../../../shared/auth';
import { createClinicalOystehrClient } from '../../../../shared/helpers';
import { wrapHandler } from '../../../../shared/sentry';
import { produceInvoiceIssuedOutreach } from '../shared/produce-invoice-issued-outreach';

let m2mToken: string;

const ZAMBDA_NAME = 'produce-outreach-invoice-issued-tasks';

/**
 * Zambda handler: thin wrapper over produceInvoiceIssuedOutreach.
 *
 * Input body: { invoiceId: string }
 */
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  if (!input.body) throw MISSING_REQUIRED_PARAMETERS(['body']);
  if (!input.secrets) throw new Error('Secrets are not defined');

  const body = JSON.parse(input.body);

  const invoiceId = body.invoiceId;
  if (!invoiceId || typeof invoiceId !== 'string') {
    throw INVALID_INPUT_ERROR('invoiceId is required and must be a non-empty string');
  }

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, input.secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, input.secrets);

  const result = await produceInvoiceIssuedOutreach({
    invoiceId,
    oystehr,
    validateStatus: true,
  });

  return {
    statusCode: 200,
    body: JSON.stringify({
      created: result.created.length,
      skipped: result.skipped.length,
    }),
  };
});
