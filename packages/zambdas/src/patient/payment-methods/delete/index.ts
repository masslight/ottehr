import { wrapHandler } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import { getSecret, SecretsKeys, STRIPE_RESOURCE_ACCESS_NOT_AUTHORIZED_ERROR } from 'utils';
import { createOystehrClient, getAuth0Token, lambdaResponse, topLevelCatch, ZambdaInput } from '../../../shared';
import { getStripeClient, validateUserHasAccessToPatientAccount } from '../helpers';
import { complexValidation, validateRequestParameters } from './validateRequestParameters';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2MClientToken: string;
export const index = wrapHandler(async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
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

    if (!m2MClientToken) {
      console.log('getting m2m token for service calls');
      m2MClientToken = await getAuth0Token(secrets); // keeping token externally for reuse
    } else {
      console.log('already have a token, no need to update');
    }

    const oystehrClient = createOystehrClient(m2MClientToken, secrets);

    void (await validateUserHasAccessToPatientAccount(
      { beneficiaryPatientId, secrets, zambdaInput: input },
      oystehrClient
    ));

    const { stripeCustomerId } = await complexValidation({ patientId: beneficiaryPatientId, oystehrClient });
    const stripeClient = getStripeClient(secrets);

    // check if payment method is assigned to the customer to begin with, before updating the
    // customer invoice settings
    const paymentMethod = await stripeClient.paymentMethods.retrieve(paymentMethodId);
    if (paymentMethod !== undefined && paymentMethod.customer === stripeCustomerId) {
      const detachedPaymentMethod = await stripeClient.paymentMethods.detach(paymentMethodId);
      console.log(
        `Payment method (${detachedPaymentMethod.id}) successfully detached from customer (${paymentMethod.customer}).`
      );
    } else {
      console.error(
        `Stripe payment method with ID ${paymentMethod.id} belongs to ${paymentMethod.customer} and not ${stripeCustomerId}`
      );
      throw STRIPE_RESOURCE_ACCESS_NOT_AUTHORIZED_ERROR;
    }

    return lambdaResponse(204, null);
  } catch (error: any) {
    console.error(error);
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('payment-methods-delete', error, ENVIRONMENT);
  }
});
