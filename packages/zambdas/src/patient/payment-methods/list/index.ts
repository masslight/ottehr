import { APIGatewayProxyResult } from 'aws-lambda';
import { createOystehrClient, getAuth0Token, lambdaResponse, topLevelCatch, ZambdaInput } from '../../../shared';
import { getStripeClient, validateUserHasAccessToPatienAccount } from '../helpers';
import { validateRequestParameters } from './validateRequestParameters';
import { getAccountAndCoverageResourcesForPatient } from '../../../ehr/shared/harvest';
import {
  CreditCardInfo,
  FHIR_RESOURCE_NOT_FOUND,
  getStripeCustomerIdFromAccount,
  ListPaymentMethodsZambdaOutput,
} from 'utils';
import { Account } from 'fhir/r4b';
import Stripe from 'stripe';
import { DateTime } from 'luxon';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let zapehrM2MClientToken: string;
export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
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

    const { beneficiaryPatientId, secrets } = validatedParameters;
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

    const stripeClient = getStripeClient(secrets);

    const accountResources = await getAccountAndCoverageResourcesForPatient(beneficiaryPatientId, oystehrClient);
    const account: Account | undefined = accountResources.account;

    if (!account?.id) {
      throw FHIR_RESOURCE_NOT_FOUND('Account');
    }
    const output: ListPaymentMethodsZambdaOutput = { cards: [] };
    const customerId = account ? getStripeCustomerIdFromAccount(account) : undefined;
    if (customerId !== undefined) {
      const customer = await stripeClient.customers.retrieve(customerId, {
        expand: ['invoice_settings.default_payment_method', 'sources'],
      });
      const paymentMethods = (
        await stripeClient.customers.listPaymentMethods(customer.id, {
          type: 'card',
        })
      )?.data;
      console.log('payment methods', paymentMethods, JSON.stringify(customer, null, 2));
      if (
        customer !== undefined &&
        customer.deleted !== true &&
        customer.invoice_settings?.default_payment_method !== undefined &&
        customer.invoice_settings?.default_payment_method !== null
      ) {
        const defaultPaymentMethod: Stripe.PaymentMethod = customer.invoice_settings
          ?.default_payment_method as Stripe.PaymentMethod;
        if (
          defaultPaymentMethod !== undefined &&
          defaultPaymentMethod.type === 'card' &&
          defaultPaymentMethod.card !== undefined
        ) {
          const allCards = paymentMethods.map((pm) => {
            return {
              id: pm.id,
              brand: pm.card!.brand,
              expMonth: pm.card!.exp_month,
              expYear: pm.card!.exp_year,
              lastFour: pm.card!.last4,
              default: pm.id === defaultPaymentMethod.id,
            };
          });
          output.cards = filterExpired(allCards).sort((a, b) => {
            if (a.default && !b.default) {
              return -1;
            }
            if (!a.default && b.default) {
              return 1;
            }
            return 0;
          });
        }
      }
    }

    return lambdaResponse(200, output);
  } catch (error: any) {
    console.error(error);
    return topLevelCatch('payment-methods-list', error, input.secrets);
  }
};

const filterExpired = (cardList: CreditCardInfo[]): CreditCardInfo[] => {
  const isExpired = (month: number, year: number): boolean => {
    const today = DateTime.now();
    const expDay = DateTime.fromObject({ year, month }).endOf('month');
    return expDay < today;
  };
  return cardList.filter((card) => {
    return !isExpired(card.expMonth, card.expYear);
  });
};
