import { User } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  createOystehrClient,
  getAuth0Token,
  getUser,
  lambdaResponse,
  topLevelCatch,
  ZambdaInput,
} from '../../../shared';
import { getStripeClient, makeStripeCustomerId } from '../helpers';
import { validateRequestParameters } from './validateRequestParameters';
import { Account, Identifier } from 'fhir/r4b';
import { FHIR_RESOURCE_NOT_FOUND, getStripeCustomerIdFromAccount, getEmailForIndividual, getFullName } from 'utils';
import { getAccountAndCoverageResourcesForPatient } from '../../../ehr/shared/harvest';
import Stripe from 'stripe';

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

    const { beneficiaryPatientId, secrets } = validatedParameters;
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

    const oystehrClient = createOystehrClient(zapehrM2MClientToken, secrets);
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
    return topLevelCatch('payment-methods-setup', error, input.secrets);
  }
};
