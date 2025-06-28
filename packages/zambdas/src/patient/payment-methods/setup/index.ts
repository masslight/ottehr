import { APIGatewayProxyResult } from 'aws-lambda';
import { Account, Identifier } from 'fhir/r4b';
import Stripe from 'stripe';
import {
  FHIR_RESOURCE_NOT_FOUND,
  getEmailForIndividual,
  getFullName,
  getSecret,
  getStripeCustomerIdFromAccount,
  SecretsKeys,
} from 'utils';
import { getAccountAndCoverageResourcesForPatient } from '../../../ehr/shared/harvest';
import {
  createOystehrClient,
  getAuth0Token,
  lambdaResponse,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { getStripeClient, makeStripeCustomerId, validateUserHasAccessToPatientAccount } from '../helpers';
import { validateRequestParameters } from './validateRequestParameters';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mClientToken: string;

export const index = wrapHandler('payment-setup', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);

    const { beneficiaryPatientId, secrets } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    if (!m2mClientToken) {
      console.log('getting m2m token for service calls');
      m2mClientToken = await getAuth0Token(secrets); // keeping token externally for reuse
    } else {
      console.log('already have a token, no need to update');
    }
    const oystehrClient = createOystehrClient(m2mClientToken, secrets);
    void (await validateUserHasAccessToPatientAccount(
      { beneficiaryPatientId, secrets, zambdaInput: input },
      oystehrClient
    ));

    const stripeClient = getStripeClient(secrets);

    const accountResources = await getAccountAndCoverageResourcesForPatient(beneficiaryPatientId, oystehrClient);
    const account: Account | undefined = accountResources.account;

    if (!account?.id) {
      throw FHIR_RESOURCE_NOT_FOUND('Account');
    }

    const guarantor = accountResources.guarantorResource;
    let customerId = account ? getStripeCustomerIdFromAccount(account) : undefined;

    if (customerId === undefined) {
      const customer = await stripeClient.customers.create(
        {
          email: guarantor ? getEmailForIndividual(guarantor) : undefined,
          name: guarantor ? getFullName(guarantor) : undefined,
          metadata: {
            oystehr_patient_id: beneficiaryPatientId,
          },
        },
        undefined
      );
      const op = 'add';
      let value: Identifier | Identifier[] = makeStripeCustomerId(customer.id);
      let path = '/identifier/-';
      if (account.identifier === undefined) {
        value = [value];
        path = '/identifier';
      }
      await oystehrClient.fhir.patch({
        id: account?.id,
        resourceType: 'Account',
        operations: [
          {
            op,
            path,
            value,
          },
        ],
      });
      customerId = customer.id;
    }

    const setupIntent: Stripe.SetupIntent = await stripeClient.setupIntents.create({
      customer: `${customerId}`,
      automatic_payment_methods: {
        enabled: false,
      },
      payment_method_types: ['card'],
    });

    return lambdaResponse(200, setupIntent.client_secret);
  } catch (error: any) {
    console.error(error);
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('payment-methods-setup', error, ENVIRONMENT);
  }
});
