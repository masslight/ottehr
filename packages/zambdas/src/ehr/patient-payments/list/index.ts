import Oystehr, { SearchParam } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Account, PaymentNotice } from 'fhir/r4b';
import { DateTime } from 'luxon';
import Stripe from 'stripe';
import {
  CardPaymentDTO,
  CashPaymentDTO,
  convertPaymentNoticeListToCashPaymentDTOs,
  FHIR_RESOURCE_NOT_FOUND,
  getSecret,
  getStripeCustomerIdFromAccount,
  INVALID_INPUT_ERROR,
  isValidUUID,
  ListPatientPaymentInput,
  ListPatientPaymentResponse,
  MISSING_REQUEST_BODY,
  MISSING_REQUIRED_PARAMETERS,
  NOT_AUTHORIZED,
  PatientPaymentDTO,
  Secrets,
  SecretsKeys,
} from 'utils';
import {
  createOystehrClient,
  getAuth0Token,
  getStripeClient,
  lambdaResponse,
  STRIPE_PAYMENT_ID_SYSTEM,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { getAccountAndCoverageResourcesForPatient } from '../../shared/harvest';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let oystehrM2MClientToken: string;

const ZAMBDA_NAME = 'patient-payments-list';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
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

    const secrets = input.secrets;
    const { patientId } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    if (!oystehrM2MClientToken) {
      console.log('getting m2m token for service calls');
      oystehrM2MClientToken = await getAuth0Token(secrets); // keeping token externally for reuse
    } else {
      console.log('already have a token, no need to update');
    }

    const oystehrClient = createOystehrClient(oystehrM2MClientToken, secrets);

    const accountResources = await getAccountAndCoverageResourcesForPatient(patientId, oystehrClient);
    const account: Account | undefined = accountResources.account;

    if (!account?.id) {
      throw FHIR_RESOURCE_NOT_FOUND('Account');
    }

    const effectInput = await complexValidation(
      {
        ...validatedParameters,
        secrets: input.secrets,
      },
      oystehrClient
    );

    const response = await performEffect(effectInput);

    return lambdaResponse(200, response);
  } catch (error: any) {
    console.error(error);
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('patient-payments-list', error, ENVIRONMENT);
  }
});
interface EffectInput extends ListPatientPaymentInput {
  stripeClient: Stripe;
  patientAccount: Account;
  fhirPaymentNotices: PaymentNotice[];
}
const performEffect = async (input: EffectInput): Promise<ListPatientPaymentResponse> => {
  const { patientAccount: account, patientId, encounterId, stripeClient, fhirPaymentNotices } = input;
  const stripePayments: Stripe.PaymentIntent[] = [];
  const paymentMethods: Stripe.PaymentMethod[] = [];
  const customerId = account ? getStripeCustomerIdFromAccount(account) : undefined;
  if (encounterId && customerId) {
    if (customerId) {
      const [paymentIntents, pms] = await Promise.all([
        stripeClient.paymentIntents.search({
          query: `metadata['encounterId']:"${encounterId}" OR metadata['oystehr_encounter_id']:"${encounterId}"`,
        }),
        stripeClient.paymentMethods.list({
          customer: customerId,
          type: 'card',
        }),
      ]);

      console.log('Payment Intent created:', JSON.stringify(paymentIntents, null, 2));
      stripePayments.push(...paymentIntents.data);
      paymentMethods.push(...pms.data);
    }
  } else if (customerId) {
    const [paymentIntents, pms] = await Promise.all([
      stripeClient.paymentIntents.list({
        customer: getStripeCustomerIdFromAccount(account),
      }),
      stripeClient.paymentMethods.list({
        customer: customerId,
        type: 'card',
      }),
    ]);
    stripePayments.push(...paymentIntents.data);
    paymentMethods.push(...pms.data);
  }

  const cardPayments: CardPaymentDTO[] = stripePayments.flatMap((paymentIntent) => {
    const cardUsed = paymentMethods.find((pm) => pm.id === paymentIntent.payment_method);
    const last4 = cardUsed?.card?.last4;
    const paymentMethodId = cardUsed?.id;
    if (!last4 || !paymentMethodId) {
      return [];
    }
    const fhirPaymentNoticeId = fhirPaymentNotices.find(
      (notice) =>
        notice.identifier?.some((id) => id.system === STRIPE_PAYMENT_ID_SYSTEM && id.value === paymentIntent.id) ??
        false
    )?.id;
    return {
      paymentMethod: 'card',
      stripePaymentId: paymentIntent.id,
      amountInCents: paymentIntent.amount,
      description: paymentIntent.description ?? undefined,
      stripePaymentMethodId: paymentMethodId,
      fhirPaymentNoticeId,
      cardLast4: last4,
      dateISO: DateTime.fromSeconds(paymentIntent.created).toISO(),
    };
  });

  // todo: the data here should be fetched from candid and then linked to the payment notice ala stripe,
  // but that awaits the candid integration portion
  const cashPayments: CashPaymentDTO[] = convertPaymentNoticeListToCashPaymentDTOs(fhirPaymentNotices, encounterId);

  const payments: PatientPaymentDTO[] = [...cardPayments, ...cashPayments].sort((a, b) => {
    return DateTime.fromISO(b.dateISO).toMillis() - DateTime.fromISO(a.dateISO).toMillis();
  });

  return {
    patientId,
    payments,
    encounterId,
  };
};

const complexValidation = async (
  input: ListPatientPaymentInput & { secrets: Secrets | null },
  oystehrClient: Oystehr
): Promise<EffectInput> => {
  const { patientId, encounterId, secrets } = input;
  const accountResources = await getAccountAndCoverageResourcesForPatient(patientId, oystehrClient);
  const account: Account | undefined = accountResources.account;

  if (!account?.id) {
    throw FHIR_RESOURCE_NOT_FOUND('Account');
  }

  const stripeClient = getStripeClient(secrets);

  const params: SearchParam[] = [];

  if (encounterId) {
    params.push({
      name: 'request',
      value: `Encounter/${encounterId}`,
    });
  } else {
    params.push({
      name: 'request.patient._id',
      value: patientId,
    });
  }

  const fhirPaymentNotices: PaymentNotice[] = (
    await oystehrClient.fhir.search<PaymentNotice>({
      resourceType: 'PaymentNotice',
      params,
    })
  ).unbundle();

  return {
    patientId,
    encounterId,
    stripeClient,
    patientAccount: account,
    fhirPaymentNotices,
  };
};

const validateRequestParameters = (input: ZambdaInput): ListPatientPaymentInput => {
  const authorization = input.headers.Authorization;
  if (!authorization) {
    throw NOT_AUTHORIZED;
  }
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { patientId, encounterId } = JSON.parse(input.body);

  if (!patientId) {
    throw MISSING_REQUIRED_PARAMETERS(['patientId']);
  }

  if (!isValidUUID(patientId)) {
    throw INVALID_INPUT_ERROR('"patientId" must be a valid UUID.');
  }
  if (encounterId && !isValidUUID(encounterId)) {
    throw INVALID_INPUT_ERROR('"encounterId" must be a valid UUID.');
  }

  return {
    patientId,
    encounterId,
  };
};
