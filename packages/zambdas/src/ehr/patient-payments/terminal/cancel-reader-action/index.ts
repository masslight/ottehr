import { APIGatewayProxyResult } from 'aws-lambda';
import {
  CancelTerminalReaderActionInput,
  CancelTerminalReaderActionResponse,
  getStripeAccountForAppointmentOrEncounter,
  INVALID_INPUT_ERROR,
  isValidUUID,
  MISSING_REQUEST_BODY,
  MISSING_REQUIRED_PARAMETERS,
} from 'utils';
import {
  createClinicalOystehrClient,
  getAuth0Token,
  getStripeClient,
  lambdaResponse,
  wrapHandler,
  ZambdaInput,
} from '../../../../shared';

const ZAMBDA_NAME = 'patient-payments-terminal-cancel-reader-action';

let oystehrM2MClientToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const validatedParameters = validateRequestParameters(input);

  if (!oystehrM2MClientToken) {
    oystehrM2MClientToken = await getAuth0Token(input.secrets);
  }

  const oystehrClient = createClinicalOystehrClient(oystehrM2MClientToken, input.secrets);
  const stripeAccount = await getStripeAccountForAppointmentOrEncounter(
    { encounterId: validatedParameters.encounterId },
    oystehrClient
  );

  const stripeClient = getStripeClient(input.secrets);

  await stripeClient.terminal.readers.cancelAction(validatedParameters.readerId, {
    stripeAccount,
  });

  const response: CancelTerminalReaderActionResponse = {
    success: true,
  };

  return lambdaResponse(200, response);
});

const validateRequestParameters = (input: ZambdaInput): CancelTerminalReaderActionInput => {
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
