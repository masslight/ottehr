import { APIGatewayProxyResult } from 'aws-lambda';
import { SaveInvoiceConfigBodySchema } from 'utils/lib/types/api/invoice-config.types';
import { saveInvoicingConfig } from '../../rcm/invoice-config/helpers';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { validateWithSchema } from '../../shared/validation';
import { createBillingClient } from '../shared';

let m2mToken: string;
const ZAMBDA_NAME = 'save-billing-invoice-config';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { secrets, ...values } = validateWithSchema(SaveInvoiceConfigBodySchema, input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createBillingClient(m2mToken, secrets);

  const response = await saveInvoicingConfig(oystehr, values);

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});
