import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  FHIR_RESOURCE_NOT_FOUND,
  GetPatientPaymentTerminalConnectionTokenInput,
  GetPatientPaymentTerminalConnectionTokenResponse,
  getSecret,
  getStripeAccountForAppointmentOrEncounter,
  getStripeCustomerIdFromAccount,
  INVALID_INPUT_ERROR,
  isValidUUID,
  MISSING_REQUEST_BODY,
  MISSING_REQUIRED_PARAMETERS,
  NOT_AUTHORIZED,
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

const ZAMBDA_NAME = 'patient-payments-terminal-get-connection-token';

let oystehrM2MClientToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const authorization = input.headers.Authorization;
    if (!authorization) {
      throw NOT_AUTHORIZED;
    }

    const validatedParameters = validateRequestParameters(input);

    if (!oystehrM2MClientToken) {
      oystehrM2MClientToken = await getAuth0Token(input.secrets);
    }

    const oystehrClient = createOystehrClient(oystehrM2MClientToken, input.secrets);
    const { stripeAccount } = await getStripePaymentContext(validatedParameters, oystehrClient);

    console.log('\n\n\n>>>>>>> ZING >>>> STRIPE account\n\n\n ', stripeAccount);

    const stripeClient = getStripeClient(input.secrets);
    const connectionToken = await stripeClient.terminal.connectionTokens.create(
      {},
      {
        stripeAccount,
      }
    );

    console.log('\n\n\n>>>>>>> ZING >>>> STRIPE connection token\n\n\n ', JSON.stringify(connectionToken, null, 2));

    const response: GetPatientPaymentTerminalConnectionTokenResponse = {
      connectionToken: connectionToken.secret,
    };

    return lambdaResponse(200, response);
  } catch (error: any) {
    console.error(error);
    const environment = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch(ZAMBDA_NAME, error, environment);
  }
});

const validateRequestParameters = (input: ZambdaInput): GetPatientPaymentTerminalConnectionTokenInput => {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { patientId, encounterId } = JSON.parse(input.body);

  const missingParams: string[] = [];
  if (!patientId) {
    missingParams.push('patientId');
  }
  if (!encounterId) {
    missingParams.push('encounterId');
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

  return {
    patientId,
    encounterId,
  };
};

const getStripePaymentContext = async (
  input: GetPatientPaymentTerminalConnectionTokenInput,
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
