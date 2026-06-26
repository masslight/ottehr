import { APIGatewayProxyResult } from 'aws-lambda';
import { checkOrCreateM2MClientToken, createClinicalOystehrClient, wrapHandler, ZambdaInput } from '../../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
export const index = wrapHandler('delete-charge-master', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { id, secrets } = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  await oystehr.fhir.delete({
    resourceType: 'ChargeItemDefinition',
    id,
  });

  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Charge master deleted successfully' }),
  };
});
