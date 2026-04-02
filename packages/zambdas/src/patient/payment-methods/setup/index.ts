import { APIGatewayProxyResult } from 'aws-lambda';
import { Account } from 'fhir/r4b';
import Stripe from 'stripe';
import {
  checkForStripeCustomerDeletedError,
  FHIR_RESOURCE_NOT_FOUND,
  getSecret,
  getStripeAccountForAppointmentOrEncounter,
  PaymentMethodSetupZambdaOutput,
  SecretsKeys,
} from 'utils';
import { getAccountAndCoverageResourcesForPatient } from '../../../ehr/shared/harvest';
import {
  createOystehrClient,
  ensureStripeCustomerId,
  lambdaResponse,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { getStripeClient, validateUserHasAccessToPatientAccount } from '../helpers';
import { validateRequestParameters } from './validateRequestParameters';

export const index = wrapHandler('payment-setup', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);

    const { beneficiaryPatientId, appointmentId, secrets } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    const oystehrClient = createOystehrClient(input.accessToken!, secrets);
    void (await validateUserHasAccessToPatientAccount(
      { beneficiaryPatientId, secrets, zambdaInput: input },
      oystehrClient
    ));

    const stripeAccount = await getStripeAccountForAppointmentOrEncounter({ appointmentId }, oystehrClient);
    console.log('Using stripe account: ', stripeAccount);

    const stripeClient = getStripeClient(secrets);

    const accountResources = await getAccountAndCoverageResourcesForPatient(beneficiaryPatientId, oystehrClient);
    const account: Account | undefined = accountResources.account;

    if (!account?.id) {
      throw FHIR_RESOURCE_NOT_FOUND('Account');
    }

    const guarantor = accountResources.guarantorResource;
    const { customerId } = await ensureStripeCustomerId(
      {
        guarantorResource: guarantor,
        account,
        patientId: beneficiaryPatientId,
        stripeClient,
        stripeAccount,
      },
      oystehrClient
    );
    console.log('Using stripe customer ID: ', customerId);

    let setupIntent: Stripe.SetupIntent | undefined;
    try {
      setupIntent = await stripeClient.setupIntents.create(
        {
          customer: `${customerId}`,
          automatic_payment_methods: {
            enabled: false,
          },
          payment_method_types: ['card'],
        },
        {
          stripeAccount, // Connected account ID if any
        }
      );
    } catch (stripeError: any) {
      throw checkForStripeCustomerDeletedError(stripeError);
    }

    if (!setupIntent.client_secret) {
      throw new Error('Failed to create SetupIntent');
    }

    const response: PaymentMethodSetupZambdaOutput = {
      clientSecret: setupIntent.client_secret,
      stripeAccount,
    };

    return lambdaResponse(200, response);
  } catch (error: any) {
    console.error(error);
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('payment-methods-setup', error, ENVIRONMENT);
  }
});
