import { APIGatewayProxyResult } from 'aws-lambda';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../../shared';
import { getOrCreateInvoicingConfig } from '../helpers';

let m2mToken: string;
export const index = wrapHandler('get-invoice-config', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  if (!input.secrets) throw new Error('Secrets are not defined');

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, input.secrets);
  const oystehr = createOystehrClient(m2mToken, input.secrets);

  const { questionnaire, questionnaireResponse } = await getOrCreateInvoicingConfig(oystehr);

  return {
    statusCode: 200,
    body: JSON.stringify({ questionnaire, questionnaireResponse }),
  };
});
