import { APIGatewayProxyResult } from 'aws-lambda';
import Stripe from 'stripe';
import {
  CheckPatientPaymentTerminalStatusInput,
  CheckPatientPaymentTerminalStatusResponse,
  getStripeAccountForAppointmentOrEncounter,
  INVALID_INPUT_ERROR,
  isValidUUID,
  MISSING_REQUEST_BODY,
  MISSING_REQUIRED_PARAMETERS,
  TerminalPaymentActionStatus,
} from 'utils';
import {
  createOystehrClient,
  getAuth0Token,
  getStripeClient,
  lambdaResponse,
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

    const actionStatus: TerminalPaymentActionStatus =
      (reader.action?.status as TerminalPaymentActionStatus) ?? 'in_progress';

    const response: CheckPatientPaymentTerminalStatusResponse = {
      actionStatus,
      failureCode: reader.action?.failure_code ?? null,
      failureMessage: reader.action?.failure_message ?? null,
    };

    return lambdaResponse(200, response);
  } catch (error: any) {
    console.error(error);
    throw error;
  }
});

const validateRequestParameters = (input: ZambdaInput): CheckPatientPaymentTerminalStatusInput => {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { encounterId, readerId } = JSON.parse(input.body);

  const missingParams: string[] = [];
  if (!encounterId) {
    missingParams.push('encounterId');
  }
  if (!readerId) {
    missingParams.push('readerId');
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

  return {
    encounterId,
    readerId,
  };
};
