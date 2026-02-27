import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Identifier, Money, PaymentNotice, PaymentReconciliation, Reference } from 'fhir/r4b';
import { DateTime } from 'luxon';
import Stripe from 'stripe';
import {
  FHIR_RESOURCE_NOT_FOUND,
  FinalizePatientPaymentTerminalInput,
  FinalizePatientPaymentTerminalResponse,
  GENERIC_STRIPE_PAYMENT_ERROR,
  getSecret,
  getStripeAccountForAppointmentOrEncounter,
  getStripeCustomerIdFromAccount,
  getTaskResource,
  INVALID_INPUT_ERROR,
  isValidUUID,
  MISSING_REQUEST_BODY,
  MISSING_REQUIRED_PARAMETERS,
  NOT_AUTHORIZED,
  parseStripeError,
  PAYMENT_METHOD_EXTENSION_URL,
  SecretsKeys,
  STRIPE_CUSTOMER_ID_NOT_FOUND_ERROR,
  TaskIndicator,
  TIMEZONES,
} from 'utils';
import {
  createOystehrClient,
  getAuth0Token,
  getStripeClient,
  getUser,
  lambdaResponse,
  makeBusinessIdentifierForStripePayment,
  STRIPE_PAYMENT_ID_SYSTEM,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../../../shared';
import { getAccountAndCoverageResourcesForPatient } from '../../../shared/harvest';

const ZAMBDA_NAME = 'patient-payments-terminal-finalize-payment';

let oystehrM2MClientToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const authorization = input.headers.Authorization;
    if (!authorization) {
      throw NOT_AUTHORIZED;
    }

    const user = await getUser(authorization.replace('Bearer ', ''), input.secrets);
    if (!user.profile) {
      throw NOT_AUTHORIZED;
    }

    const validatedParameters = validateRequestParameters(input);

    if (!oystehrM2MClientToken) {
      oystehrM2MClientToken = await getAuth0Token(input.secrets);
    }

    const oystehrClient = createOystehrClient(oystehrM2MClientToken, input.secrets);
    const stripeContext = await getStripePaymentContext(validatedParameters, oystehrClient);

    const stripeClient = getStripeClient(input.secrets);
    const paymentIntent = await retrieveTerminalPaymentIntent(
      stripeClient,
      validatedParameters.paymentIntentId,
      stripeContext.stripeAccount
    );

    if (paymentIntent.status !== 'succeeded') {
      throw GENERIC_STRIPE_PAYMENT_ERROR;
    }

    const paymentMethodId = getPaymentMethodIdForDefault(paymentIntent);
    if (paymentMethodId) {
      await setDefaultPaymentMethodForCustomer(
        stripeClient,
        stripeContext.stripeCustomerId,
        paymentMethodId,
        stripeContext.stripeAccount
      );
    }

    const amountInCents = paymentIntent.amount_received || paymentIntent.amount;
    const paymentNotice = await createPaymentNoticeAndTask(
      {
        encounterId: validatedParameters.encounterId,
        amountInCents,
        stripePaymentIntentId: paymentIntent.id,
        submitterRef: { reference: user.profile },
      },
      oystehrClient,
      input
    );

    const response: FinalizePatientPaymentTerminalResponse = {
      patientId: validatedParameters.patientId,
      encounterId: validatedParameters.encounterId,
      paymentIntentId: paymentIntent.id,
      paymentNoticeId: paymentNotice.id,
      defaultPaymentMethodId: paymentMethodId,
    };

    return lambdaResponse(200, response);
  } catch (error: any) {
    console.error(error);
    const environment = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch(ZAMBDA_NAME, error, environment);
  }
});

const validateRequestParameters = (input: ZambdaInput): FinalizePatientPaymentTerminalInput => {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { patientId, encounterId, paymentIntentId } = JSON.parse(input.body);

  const missingParams: string[] = [];
  if (!patientId) {
    missingParams.push('patientId');
  }
  if (!encounterId) {
    missingParams.push('encounterId');
  }
  if (!paymentIntentId) {
    missingParams.push('paymentIntentId');
  }

  if (missingParams.length > 0) {
    throw MISSING_REQUIRED_PARAMETERS(missingParams);
  }

  if (!isValidUUID(patientId)) {
    throw INVALID_INPUT_ERROR('"patientId" must be a valid UUID.');
  }
  if (!isValidUUID(encounterId)) {
    throw INVALID_INPUT_ERROR('"encounterId" must be a valid UUID.');
  }
  if (typeof paymentIntentId !== 'string' || !paymentIntentId.startsWith('pi_')) {
    throw INVALID_INPUT_ERROR('"paymentIntentId" must be a valid Stripe PaymentIntent ID.');
  }

  return {
    patientId,
    encounterId,
    paymentIntentId,
  };
};

const getStripePaymentContext = async (
  input: FinalizePatientPaymentTerminalInput,
  oystehrClient: Oystehr
): Promise<{ stripeCustomerId: string; stripeAccount?: string }> => {
  const patientAccount = await getAccountAndCoverageResourcesForPatient(input.patientId, oystehrClient);
  if (!patientAccount.account) {
    throw FHIR_RESOURCE_NOT_FOUND('Account');
  }

  const stripeAccount = await getStripeAccountForAppointmentOrEncounter(
    { encounterId: input.encounterId },
    oystehrClient
  );

  const stripeCustomerId = getStripeCustomerIdFromAccount(patientAccount.account, stripeAccount);
  if (!stripeCustomerId) {
    throw STRIPE_CUSTOMER_ID_NOT_FOUND_ERROR;
  }

  return {
    stripeCustomerId,
    stripeAccount,
  };
};

const retrieveTerminalPaymentIntent = async (
  stripeClient: Stripe,
  paymentIntentId: string,
  stripeAccount?: string
): Promise<Stripe.Response<Stripe.PaymentIntent>> => {
  try {
    return await stripeClient.paymentIntents.retrieve(
      paymentIntentId,
      {
        expand: ['latest_charge'],
      },
      {
        stripeAccount,
      }
    );
  } catch (error) {
    throw parseStripeError(error);
  }
};

const getPaymentMethodIdForDefault = (paymentIntent: Stripe.PaymentIntent): string | undefined => {
  const latestCharge = typeof paymentIntent.latest_charge === 'string' ? undefined : paymentIntent.latest_charge;
  const chargePaymentDetails = latestCharge?.payment_method_details;

  const generatedCard =
    chargePaymentDetails?.type === 'card_present' ? chargePaymentDetails.card_present?.generated_card : undefined;

  if (generatedCard) {
    return generatedCard;
  }

  return typeof paymentIntent.payment_method === 'string' ? paymentIntent.payment_method : undefined;
};

const setDefaultPaymentMethodForCustomer = async (
  stripeClient: Stripe,
  stripeCustomerId: string,
  paymentMethodId: string,
  stripeAccount?: string
): Promise<void> => {
  try {
    await stripeClient.customers.update(
      stripeCustomerId,
      {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      },
      {
        stripeAccount,
      }
    );
  } catch (error) {
    throw parseStripeError(error);
  }
};

interface PaymentNoticeInput {
  encounterId: string;
  amountInCents: number;
  stripePaymentIntentId: string;
  submitterRef: Reference;
}

const createPaymentNoticeAndTask = async (
  input: PaymentNoticeInput,
  oystehrClient: Oystehr,
  zambdaInput: ZambdaInput
): Promise<PaymentNotice> => {
  const organizationId = getSecret(SecretsKeys.ORGANIZATION_ID, zambdaInput.secrets);
  const { encounterId, amountInCents, stripePaymentIntentId, submitterRef } = input;

  const existingPaymentNotice = await findPaymentNoticeByStripePaymentIntent(
    oystehrClient,
    encounterId,
    stripePaymentIntentId
  );
  if (existingPaymentNotice) {
    return existingPaymentNotice;
  }

  const dateTimeIso = DateTime.now().toISO() || '';

  const noticeToWrite = makeTerminalPaymentNotice({
    encounterId,
    amountInCents,
    stripePaymentIntentId,
    submitterRef,
    recipientId: organizationId,
    dateTimeIso,
  });

  const paymentNotice = await oystehrClient.fhir.create<PaymentNotice>(noticeToWrite);

  if (!paymentNotice.id) {
    throw new Error('PaymentNotice ID is required to create task');
  }

  const paymentTaskResource = getTaskResource(
    TaskIndicator.patientPaymentCandidSyncAndReceipt,
    `Payment notice for $${(amountInCents / 100).toFixed(2)}`,
    paymentNotice.id,
    encounterId
  );
  paymentTaskResource.focus = {
    type: 'PaymentNotice',
    reference: `PaymentNotice/${paymentNotice.id}`,
  };

  await oystehrClient.fhir.create(paymentTaskResource);
  return paymentNotice;
};

const findPaymentNoticeByStripePaymentIntent = async (
  oystehrClient: Oystehr,
  encounterId: string,
  stripePaymentIntentId: string
): Promise<PaymentNotice | undefined> => {
  const paymentNotices = (
    await oystehrClient.fhir.search<PaymentNotice>({
      resourceType: 'PaymentNotice',
      params: [
        {
          name: 'request',
          value: `Encounter/${encounterId}`,
        },
      ],
    })
  ).unbundle();

  return paymentNotices.find(
    (paymentNotice) =>
      paymentNotice.identifier?.some(
        (identifier) => identifier.system === STRIPE_PAYMENT_ID_SYSTEM && identifier.value === stripePaymentIntentId
      )
  );
};

interface MakeTerminalPaymentNoticeInput extends PaymentNoticeInput {
  recipientId: string;
  dateTimeIso: string;
}

const makeTerminalPaymentNotice = (input: MakeTerminalPaymentNoticeInput): PaymentNotice => {
  const { encounterId, amountInCents, stripePaymentIntentId, submitterRef, recipientId, dateTimeIso } = input;

  const identifier: Identifier = makeBusinessIdentifierForStripePayment(stripePaymentIntentId);
  const paymentDate = DateTime.fromISO(dateTimeIso).setZone(TIMEZONES[0]).toFormat('yyyy-MM-dd');
  const created = DateTime.fromISO(dateTimeIso).toUTC().toISO();

  if (!created) {
    throw new Error('Invalid dateTimeIso provided for PaymentNotice creation');
  }

  const paymentAmount: Money = {
    value: amountInCents / 100,
    currency: 'USD',
  };

  const reconciliation: PaymentReconciliation = {
    resourceType: 'PaymentReconciliation',
    id: 'contained-reconciliation',
    status: 'active',
    created,
    disposition: 'card-present payment intent processed with Stripe Terminal',
    outcome: 'complete',
    paymentDate,
    paymentAmount,
    detail: [
      {
        type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/payment-type', code: 'payment' }] },
        submitter: submitterRef,
      },
    ],
  };

  return {
    resourceType: 'PaymentNotice',
    status: 'active',
    request: { reference: `Encounter/${encounterId}`, type: 'Encounter' },
    created,
    amount: paymentAmount,
    contained: [reconciliation],
    identifier: [identifier],
    extension: [
      {
        url: PAYMENT_METHOD_EXTENSION_URL,
        valueString: 'card-reader',
      },
    ],
    payment: {
      reference: `#${reconciliation.id}`,
    },
    recipient: { reference: `Organization/${recipientId}` },
  };
};
