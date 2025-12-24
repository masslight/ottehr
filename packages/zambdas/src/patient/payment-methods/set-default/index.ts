import { APIGatewayProxyResult } from 'aws-lambda';
import {
  checkForStripeCustomerDeletedError,
  getSecret,
  getStripeAccountForAppointmentOrEncounter,
  SecretsKeys,
} from 'utils';
import {
  createOystehrClient,
  getAuth0Token,
  lambdaResponse,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { getStripeClient, validateUserHasAccessToPatientAccount } from '../helpers';
import { complexValidation, validateRequestParameters } from './validateRequestParameters';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let oystehrM2MClientToken: string;
export const index = wrapHandler('payment-set-default', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);

    const { beneficiaryPatientId, paymentMethodId, appointmentId, secrets } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    if (!oystehrM2MClientToken) {
      console.log('getting m2m token for service calls');
      oystehrM2MClientToken = await getAuth0Token(secrets); // keeping token externally for reuse
    } else {
      console.log('already have a token, no need to update');
    }
    const oystehrClient = createOystehrClient(oystehrM2MClientToken, secrets);

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

    const stripeAccount = await getStripeAccountForAppointmentOrEncounter({ appointmentId }, oystehrClient);

    try {
      const customer = await stripeClient.customers.update(
        stripeCustomerId,
        {
          invoice_settings: {
            default_payment_method: paymentMethodId,
          },
        },
        {
          stripeAccount, // Connected account ID if any
        }
      );
      console.log('customer updated', customer);
    } catch (stripeError: any) {
      throw checkForStripeCustomerDeletedError(stripeError);
    }

    return lambdaResponse(200, {});
  } catch (error: any) {
    console.error(error);
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('payment-methods-set-default', error, ENVIRONMENT);
  }
});
