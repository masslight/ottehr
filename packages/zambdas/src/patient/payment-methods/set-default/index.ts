import { APIGatewayProxyResult } from 'aws-lambda';
import { createOystehrClient, getAuth0Token, lambdaResponse, topLevelCatch, ZambdaInput } from '../../../shared';
import { getStripeClient, validateUserHasAccessToPatienAccount } from '../helpers';
import { complexValidation, validateRequestParameters } from './validateRequestParameters';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let zapehrM2MClientToken: string;
export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);

    const { beneficiaryPatientId, paymentMethodId, secrets } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    if (!zapehrM2MClientToken) {
      console.log('getting m2m token for service calls');
      zapehrM2MClientToken = await getAuth0Token(secrets); // keeping token externally for reuse
    } else {
      console.log('already have a token, no need to update');
    }
    const oystehrClient = createOystehrClient(zapehrM2MClientToken, secrets);

    void (await validateUserHasAccessToPatienAccount(
      { beneficiaryPatientId, secrets, zambdaInput: input },
      oystehrClient
    ));
    const { stripeCustomerId } = await complexValidation({ patientId: beneficiaryPatientId, oystehrClient });

    const stripeClient = getStripeClient(secrets);
    const customer = await stripeClient.customers.update(stripeCustomerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    console.log('customer updated', customer);

    return lambdaResponse(200, {});
  } catch (error: any) {
    console.error(error);
    return topLevelCatch('payment-methods-set-default', error, input.secrets);
  }
};
