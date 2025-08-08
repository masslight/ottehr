import { APIGatewayProxyResult } from 'aws-lambda';
import { getSecret, SecretsKeys } from 'utils';
import { checkOrCreateM2MClientToken, topLevelCatch, wrapHandler, ZambdaInput } from '../../shared';
import { createPatientPaymentReceiptPdf } from '../../shared/pdf/patient-payment-receipt-pdf';
import { validateRequestParameters } from './validateRequestParameters';

let oystehrToken: string;

export const index = wrapHandler('create-receipt', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const validatedParameters = validateRequestParameters(input);
    const { encounterId, patientId, secrets } = validatedParameters;

    oystehrToken = await checkOrCreateM2MClientToken(oystehrToken, secrets);

    const response = await createPatientPaymentReceiptPdf(encounterId, patientId, secrets, oystehrToken);
    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    await topLevelCatch('create-receipt', error, ENVIRONMENT);
    console.log('Error: ', JSON.stringify(error.message));
    return {
      statusCode: 500,
      body: JSON.stringify(error.message),
    };
  }
});
