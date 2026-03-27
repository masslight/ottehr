import { APIGatewayProxyResult } from 'aws-lambda';
import Stripe from 'stripe';
import {
  CheckPatientPaymentTerminalStatusInput,
  CheckPatientPaymentTerminalStatusResponse,
  getSecret,
  getStripeAccountForAppointmentOrEncounter,
  INVALID_INPUT_ERROR,
  isValidUUID,
  MISSING_REQUEST_BODY,
  MISSING_REQUIRED_PARAMETERS,
  SecretsKeys,
  TerminalPaymentActionStatus,
} from 'utils';
import {
  createOystehrClient,
  getAuth0Token,
  getStripeClient,
  lambdaResponse,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../../../shared';

const ZAMBDA_NAME = 'patient-payments-terminal-check-payment-status';

let oystehrM2MClientToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const validatedParameters = validateRequestParameters(input);

    if (!oystehrM2MClientToken) {
      oystehrM2MClientToken = await getAuth0Token(input.secrets);
    }

    const oystehrClient = createOystehrClient(oystehrM2MClientToken, input.secrets);
    const stripeAccount = await getStripeAccountForAppointmentOrEncounter(
      { encounterId: validatedParameters.encounterId },
      oystehrClient
    );

    const stripeClient = getStripeClient(input.secrets);

    // Retrieve the reader to check the action status
    const readerResponse = await stripeClient.terminal.readers.retrieve(validatedParameters.readerId, {
      stripeAccount,
    });

    if ((readerResponse as Stripe.Terminal.DeletedReader).deleted) {
      throw new Error('Terminal reader has been deleted.');
    }

    const reader = readerResponse as Stripe.Terminal.Reader;

    // Also retrieve the PaymentIntent for its status
    const paymentIntent = await stripeClient.paymentIntents.retrieve(validatedParameters.paymentIntentId, undefined, {
      stripeAccount,
    });

    const actionStatus: TerminalPaymentActionStatus =
      (reader.action?.status as TerminalPaymentActionStatus) ?? 'in_progress';

    const response: CheckPatientPaymentTerminalStatusResponse = {
      actionStatus,
      paymentIntentStatus: paymentIntent.status,
      failureCode: reader.action?.failure_code ?? null,
      failureMessage: reader.action?.failure_message ?? null,
    };

    return lambdaResponse(200, response);
  } catch (error: any) {
    console.error(error);
    const environment = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch(ZAMBDA_NAME, error, environment);
  }
});

const validateRequestParameters = (input: ZambdaInput): CheckPatientPaymentTerminalStatusInput => {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { encounterId, readerId, paymentIntentId } = JSON.parse(input.body);

  const missingParams: string[] = [];
  if (!encounterId) {
    missingParams.push('encounterId');
  }
  if (!readerId) {
    missingParams.push('readerId');
  }
  if (!paymentIntentId) {
    missingParams.push('paymentIntentId');
  }

  if (missingParams.length > 0) {
    throw MISSING_REQUIRED_PARAMETERS(missingParams);
  }

  if (!isValidUUID(encounterId)) {
    throw INVALID_INPUT_ERROR('"encounterId" must be a valid UUID.');
  }
  if (typeof readerId !== 'string' || !readerId.startsWith('tmr_')) {
    throw INVALID_INPUT_ERROR('"readerId" must be a valid Stripe Terminal Reader ID.');
  }
  if (typeof paymentIntentId !== 'string' || !paymentIntentId.startsWith('pi_')) {
    throw INVALID_INPUT_ERROR('"paymentIntentId" must be a valid Stripe PaymentIntent ID.');
  }

  return {
    encounterId,
    readerId,
    paymentIntentId,
  };
};
