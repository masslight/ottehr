import { APIGatewayProxyResult } from 'aws-lambda';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { createBillingClient, createEraReadClient } from '../shared';
import { searchPatientArClaims } from './handler';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'search-billing-patient-ar-claims';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.group('validateRequestParameters');
  const params = validateRequestParameters(input);
  const { secrets, ...restOfParams } = params;
  console.groupEnd();
  console.debug('validateRequestParameters success', restOfParams);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const billingClient = createBillingClient(m2mToken, secrets);
  const eraReadClient = createEraReadClient(m2mToken, secrets);

  console.group('performEffect');
  const response = await searchPatientArClaims({
    billingClient,
    eraReadClient,
    ...params,
  });
  console.groupEnd();
  console.debug('performEffect success', { total: response.total });

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});
