import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import Stripe from 'stripe';
import {
  FHIR_RESOURCE_NOT_FOUND,
  getStripeAccountForAppointmentOrEncounter,
  getStripeCustomerIdFromAccount,
  getStripeTerminalLocationIdForAppointmentOrEncounter,
  InitiatePatientPaymentTerminalInput,
  InitiatePatientPaymentTerminalResponse,
  INVALID_INPUT_ERROR,
  isValidUUID,
  MISSING_REQUEST_BODY,
  MISSING_REQUIRED_PARAMETERS,
  STRIPE_CUSTOMER_ID_NOT_FOUND_ERROR,
} from 'utils';
import {
  createOystehrClient,
  getAuth0Token,
  getStripeClient,
  lambdaResponse,
  safeJsonParse,
  wrapHandler,
  ZambdaInput,
} from '../../../../shared';
import { getAccountAndCoverageResourcesForPatient } from '../../../shared/harvest';

const ZAMBDA_NAME = 'patient-payments-terminal-initiate-payment';

const SIMULATION_TERMINAL_LOCATION_VALUES = new Set(['sim', 'simulated', 'simulation']);

let oystehrM2MClientToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const validatedParameters = validateRequestParameters(input);

  if (!oystehrM2MClientToken) {
    oystehrM2MClientToken = await getAuth0Token(input.secrets);
  }

  const oystehrClient = createOystehrClient(oystehrM2MClientToken, input.secrets);
  const { stripeCustomerId, stripeAccount } = await getStripePaymentContext(validatedParameters, oystehrClient);

  const stripeClient = getStripeClient(input.secrets);

  // Validate that the reader belongs to the encounter's configured terminal location
  const terminalLocationId = await getStripeTerminalLocationIdForAppointmentOrEncounter(
    { encounterId: validatedParameters.encounterId },
    oystehrClient
  );
  const isSimHintLocation =
    terminalLocationId && SIMULATION_TERMINAL_LOCATION_VALUES.has(terminalLocationId.toLowerCase().trim());

  const readerForValidation = await stripeClient.terminal.readers.retrieve(validatedParameters.readerId, {
    stripeAccount,
  });
  if ((readerForValidation as Stripe.Terminal.DeletedReader).deleted) {
    throw INVALID_INPUT_ERROR('Terminal reader has been deleted.');
  }
  const readerToValidate = readerForValidation as Stripe.Terminal.Reader;

  if (isSimHintLocation) {
    if (!readerToValidate.device_type.startsWith('simulated_')) {
      throw INVALID_INPUT_ERROR('Reader does not match the configured terminal location.');
    }
  } else if (terminalLocationId && readerToValidate.location !== terminalLocationId) {
    throw INVALID_INPUT_ERROR('Reader does not belong to the terminal location configured for this encounter.');
  }

  // Step 1: Create the PaymentIntent server-side
  const paymentIntent = await stripeClient.paymentIntents.create(
    {
      amount: validatedParameters.amountInCents,
      currency: 'usd',
      customer: stripeCustomerId,
      payment_method_types: ['card_present'],
      capture_method: 'automatic',
      setup_future_usage: 'off_session',
      description:
        validatedParameters.description ?? `Terminal payment for encounter ${validatedParameters.encounterId}`,
      metadata: {
        oystehr_patient_id: validatedParameters.patientId,
        oystehr_encounter_id: validatedParameters.encounterId,
      },
    },
    {
      stripeAccount,
    }
  );

  // Step 2: Hand off to the reader via server-driven process_payment_intent
  const reader = await stripeClient.terminal.readers.processPaymentIntent(
    validatedParameters.readerId,
    {
      payment_intent: paymentIntent.id,
    },
    {
      stripeAccount,
    }
  );

  // Step 3: For simulated readers, explicitly present a payment method
  // (simulated readers in server-driven mode don't auto-respond like in the JS SDK)
  if (validatedParameters.simulatedReader) {
    await stripeClient.testHelpers.terminal.readers.presentPaymentMethod(
      validatedParameters.readerId,
      stripeAccount ? { stripeAccount } : undefined
    );
  }

  const readerActionStatus = reader.action?.status ?? 'in_progress';

  const response: InitiatePatientPaymentTerminalResponse = {
    paymentIntentId: paymentIntent.id,
    readerId: reader.id,
    readerActionStatus,
  };

  return lambdaResponse(200, response);
});

const validateRequestParameters = (input: ZambdaInput): InitiatePatientPaymentTerminalInput => {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { patientId, encounterId, amountInCents, readerId, simulatedReader, description } = safeJsonParse(input.body);

  const missingParams: string[] = [];
  if (!patientId) {
    missingParams.push('patientId');
  }
  if (!encounterId) {
    missingParams.push('encounterId');
  }
  if (amountInCents === undefined || amountInCents === null) {
    missingParams.push('amountInCents');
  }
  if (!readerId) {
    missingParams.push('readerId');
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

  const verifiedAmountInCents = typeof amountInCents === 'number' ? amountInCents : Number(amountInCents);
  if (
    !Number.isFinite(verifiedAmountInCents) ||
    !Number.isInteger(verifiedAmountInCents) ||
    verifiedAmountInCents <= 0
  ) {
    throw INVALID_INPUT_ERROR('"amountInCents" must be a valid non-zero integer.');
  }

  if (typeof readerId !== 'string' || !readerId.startsWith('tmr_')) {
    throw INVALID_INPUT_ERROR('"readerId" must be a valid Stripe Terminal Reader ID.');
  }

  if (description !== undefined && typeof description !== 'string') {
    throw INVALID_INPUT_ERROR('"description" must be a string if provided.');
  }

  return {
    patientId,
    encounterId,
    amountInCents: verifiedAmountInCents,
    readerId,
    simulatedReader: simulatedReader === true,
    description,
  };
};

const getStripePaymentContext = async (
  input: InitiatePatientPaymentTerminalInput,
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
