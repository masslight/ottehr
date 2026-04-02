import { APIGatewayProxyResult } from 'aws-lambda';
import { getSecret, SecretsKeys, STRIPE_RESOURCE_ACCESS_NOT_AUTHORIZED_ERROR } from 'utils';
import { createOystehrClient, lambdaResponse, topLevelCatch, wrapHandler, ZambdaInput } from '../../../shared';
import { getStripeClient, validateUserHasAccessToPatientAccount } from '../helpers';
import { complexValidation, validateRequestParameters } from './validateRequestParameters';

export const index = wrapHandler('del-payment-method', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`Input: ${JSON.stringify(input)}`);
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

    const { beneficiaryPatientId, appointmentId, paymentMethodId, secrets } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    const oystehrClient = createOystehrClient(input.accessToken!, secrets);

    void (await validateUserHasAccessToPatientAccount(
      { beneficiaryPatientId, secrets, zambdaInput: input },
      oystehrClient
    ));

    const { stripeCustomerId } = await complexValidation({
      patientId: beneficiaryPatientId,
      appointmentId,
      oystehrClient,
    });
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
