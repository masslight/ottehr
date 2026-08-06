import { APIGatewayProxyResult } from 'aws-lambda';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
export const index = wrapHandler('delete-fee-schedule', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { id, secrets } = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  await oystehr.fhir.delete({
    resourceType: 'ChargeItemDefinition',
    id,
  });

  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Fee schedule deleted successfully' }),
  };
});
