import { APIGatewayProxyResult } from 'aws-lambda';
import { SearchBillingPatientARClaimsInputSchema } from 'utils/lib/types/data/billing/billing.schemas';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { validateWithSchema } from '../../shared/validation';
import { createBillingClient } from '../shared';
import { searchPatientArClaims } from './handler';

let m2mToken: string;
const ZAMBDA_NAME = 'search-billing-patient-ar-claims';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.group('validateRequestParameters');
  const params = validateWithSchema(SearchBillingPatientARClaimsInputSchema, input);
  const { secrets } = params;
  console.groupEnd();

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createBillingClient(m2mToken, secrets);

  console.group('performEffect');
  const response = await searchPatientArClaims({
    oystehr,
    ...params,
  });
  console.groupEnd();
  console.debug('performEffect success', { total: response.total });

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});
