import { APIGatewayProxyResult } from 'aws-lambda';
import { getStripeAccountForAppointmentOrEncounter } from 'utils/lib/fhir/payments';
import { checkForStripeCustomerDeletedError, STRIPE_CUSTOMER_ID_DOES_NOT_EXIST_ERROR } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { lambdaResponse } from '../../../shared/lambda';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { getStripeClient, validateUserHasAccessToPatientAccount } from '../helpers';
import { complexValidation, validateRequestParameters } from './validateRequestParameters';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let oystehrM2MClientToken: string;
export const index = wrapHandler(
  'payment-unset-default',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);

    const { beneficiaryPatientId, appointmentId, secrets } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    oystehrM2MClientToken = await checkOrCreateM2MClientToken(oystehrM2MClientToken, secrets);
    const oystehrClient = createClinicalOystehrClient(oystehrM2MClientToken, secrets);

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
      const customer = await stripeClient.customers.retrieve(stripeCustomerId, { stripeAccount });
      if (customer.deleted) {
        throw STRIPE_CUSTOMER_ID_DOES_NOT_EXIST_ERROR;
      }
      const defaultPaymentMethod = customer.invoice_settings?.default_payment_method;
      const defaultPaymentMethodId =
        typeof defaultPaymentMethod === 'string' ? defaultPaymentMethod : defaultPaymentMethod?.id;

      // empty string clears invoice_settings.default_payment_method on the Stripe customer
      await stripeClient.customers.update(
        stripeCustomerId,
        {
          invoice_settings: {
            default_payment_method: '',
          },
        },
        {
          stripeAccount, // Connected account ID if any
        }
      );
      console.log('customer updated, default payment method for invoices removed', customer.id);

      if (defaultPaymentMethodId) {
        const detached = await stripeClient.paymentMethods.detach(defaultPaymentMethodId, undefined, {
          stripeAccount,
        });
        console.log(`payment method ${detached.id} detached from customer ${customer.id}`);
      }
    } catch (stripeError: any) {
      throw checkForStripeCustomerDeletedError(stripeError);
    }

    return lambdaResponse(200, {});
  }
);
