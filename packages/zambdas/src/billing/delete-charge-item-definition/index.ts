import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { createBillingClient } from '../shared';
import {
  complexValidation,
  DeleteChargeItemDefinitionParams,
  validateRequestParameters,
} from './validateRequestParameters';

let m2mToken: string;
export const index = wrapHandler(
  'delete-charge-item-definition',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    const params = validateRequestParameters(input);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
    const oystehr = createBillingClient(m2mToken, params.secrets);

    await complexValidation(oystehr, params);

    await performEffect(oystehr, params);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Charge item definition deleted successfully' }),
    };
  }
);

export async function performEffect(oystehr: Oystehr, params: DeleteChargeItemDefinitionParams): Promise<void> {
  await oystehr.fhir.delete({
    resourceType: 'ChargeItemDefinition',
    id: params.chargeItemDefinitionId,
  });
}
