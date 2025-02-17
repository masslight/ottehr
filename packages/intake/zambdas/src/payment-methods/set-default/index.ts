import { User } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import {} from 'utils';
import { ZambdaInput } from 'zambda-utils';
import { SecretsKeys, getSecret, lambdaResponse } from 'zambda-utils';
import { getAuth0Token, getUser } from '../../shared';
import { postPaymentMethodSetDefaultRequest } from '../helpers';
import { validateRequestParameters } from './validateRequestParameters';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let zapehrM2MClientToken: string;
export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const authorization = input.headers.Authorization;
    if (!authorization) {
      console.log('User is not authenticated yet');
      return lambdaResponse(401, { message: 'Unauthorized' });
    }

    console.group('validateRequestParameters');
    let validatedParameters: ReturnType<typeof validateRequestParameters>;
    try {
      validatedParameters = validateRequestParameters(input);
      console.log(JSON.stringify(validatedParameters, null, 4));
    } catch (error: any) {
      console.log(error);
      return lambdaResponse(400, { message: error.message });
    }

    const { beneficiaryPatientId, paymentMethodId, secrets } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    let user: User;
    try {
      console.log('getting user');
      user = await getUser(authorization.replace('Bearer ', ''), secrets);
      console.log(`user: ${user.name} (profile ${user.profile})`);
    } catch (error) {
      console.log('getUser error:', error);
      return lambdaResponse(401, { message: 'Unauthorized' });
    }

    if (!zapehrM2MClientToken) {
      console.log('getting m2m token for service calls');
      zapehrM2MClientToken = await getAuth0Token(secrets); // keeping token externally for reuse
    } else {
      console.log('already have a token, no need to update');
    }

    const response = await postPaymentMethodSetDefaultRequest(
      getSecret(SecretsKeys.PROJECT_API, secrets),
      zapehrM2MClientToken,
      beneficiaryPatientId,
      user.profile,
      paymentMethodId
    );

    return lambdaResponse(200, response || {});
  } catch (error: any) {
    console.error(error);
    return lambdaResponse(500, { error: 'Internal error' });
  }
};
