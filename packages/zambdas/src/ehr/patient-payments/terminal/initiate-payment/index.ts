import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  FHIR_RESOURCE_NOT_FOUND,
  getSecret,
  getStripeAccountForAppointmentOrEncounter,
  getStripeCustomerIdFromAccount,
  InitiatePatientPaymentTerminalInput,
  InitiatePatientPaymentTerminalResponse,
  INVALID_INPUT_ERROR,
  isValidUUID,
  MISSING_REQUEST_BODY,
  MISSING_REQUIRED_PARAMETERS,
  SecretsKeys,
  STRIPE_CUSTOMER_ID_NOT_FOUND_ERROR,
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
import { getAccountAndCoverageResourcesForPatient } from '../../../shared/harvest';

const ZAMBDA_NAME = 'patient-payments-terminal-initiate-payment';

let oystehrM2MClientToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const validatedParameters = validateRequestParameters(input);

    if (!oystehrM2MClientToken) {
      oystehrM2MClientToken = await getAuth0Token(input.secrets);
    }

    const oystehrClient = createOystehrClient(oystehrM2MClientToken, input.secrets);
    const { stripeCustomerId, stripeAccount } = await getStripePaymentContext(validatedParameters, oystehrClient);

    const stripeClient = getStripeClient(input.secrets);
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

    if (!paymentIntent.client_secret) {
      throw new Error('Unable to create Stripe Terminal payment intent client secret.');
    }

    const response: InitiatePatientPaymentTerminalResponse = {
      paymentIntentId: paymentIntent.id,
      paymentIntentClientSecret: paymentIntent.client_secret,
      stripeCustomerId,
      stripeAccountId: stripeAccount,
    };

    return lambdaResponse(200, response);
  } catch (error: any) {
    console.error(error);
    const environment = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch(ZAMBDA_NAME, error, environment);
  }
});

const validateRequestParameters = (input: ZambdaInput): InitiatePatientPaymentTerminalInput => {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { patientId, encounterId, amountInCents, description } = JSON.parse(input.body);

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

  if (description !== undefined && typeof description !== 'string') {
    throw INVALID_INPUT_ERROR('"description" must be a string if provided.');
  }

  return {
    patientId,
    encounterId,
    amountInCents: verifiedAmountInCents,
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
