import { APIGatewayProxyResult } from 'aws-lambda';
import { SaveInvoiceConfigBodySchema } from 'utils/lib/types/api/invoice-config.types';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { validateWithSchema } from '../../../shared/validation';
import { saveInvoicingConfig } from '../helpers';

let m2mToken: string;
export const index = wrapHandler('save-invoice-config', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { secrets, ...values } = validateWithSchema(SaveInvoiceConfigBodySchema, input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const response = await saveInvoicingConfig(oystehr, values);

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});
